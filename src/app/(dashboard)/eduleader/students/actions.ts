'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { VALID_CLASSES } from './constants';

export type StudentInput = {
  name: string;
  cicno: string;
  class: string;
  batch?: string | null;
  number?: number | null;
};

function getPrivilegedClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (serviceKey) {
    return {
      client: createSupabaseClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      }),
      isAdmin: true
    };
  }

  return {
    client: createSupabaseClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    }),
    isAdmin: false
  };
}

export async function createSingleStudent(input: StudentInput) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized: Session expired.' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isEdu = profile?.role === 'eduleader' || profile?.role === 'clgleader';
    if (!profile || !isEdu) {
      return { success: false, error: 'Unauthorized: Only Academic or College Leaders can add students.' };
    }

    const fullName = input.name.trim().toUpperCase();
    const cicno = input.cicno.trim();
    const studentClass = input.class.trim();
    const batch = input.batch ? input.batch.trim() : null;
    const phone = input.number ? input.number : null;

    if (!fullName || !cicno || !studentClass) {
      return { success: false, error: 'Full Name, CIC Number, and Class are required.' };
    }

    const email = `${cicno.toLowerCase()}@campus.com`;
    const password = `${cicno}@77`;

    const { client: privilegedClient, isAdmin } = getPrivilegedClient();

    // 1. Try PostgreSQL Atomic Function (Handles auth.users, auth.identities, profiles, students in 1 transaction)
    const { data: rpcData, error: rpcError } = await privilegedClient.rpc('create_student_full_atomic', {
      p_cicno: cicno,
      p_name: fullName,
      p_class: studentClass,
      p_batch: batch,
      p_phone: phone
    });

    if (!rpcError && rpcData?.success) {
      return {
        success: true,
        data: rpcData,
        authCreated: true,
        email,
        password
      };
    }

    // 2. Fallback if SQL function hasn't been run yet: Use Admin or ephemeral Auth with strict rollback
    let authUserId: string | null = null;
    let wasNewlyCreatedAuth = false;

    if (isAdmin) {
      const { data: authData, error: authError } = await privilegedClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: fullName, class: studentClass, cicno }
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('already') || authError.status === 422) {
          const { data: listData } = await privilegedClient.auth.admin.listUsers();
          const existing = listData?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
          if (existing) {
            authUserId = existing.id;
            await privilegedClient.auth.admin.updateUserById(existing.id, {
              password,
              user_metadata: { name: fullName, class: studentClass, cicno }
            });
          } else {
            return { success: false, error: `Auth Error: ${authError.message}` };
          }
        } else {
          return { success: false, error: `Auth creation failed: ${authError.message}` };
        }
      } else if (authData?.user) {
        authUserId = authData.user.id;
        wasNewlyCreatedAuth = true;
      }
    } else {
      const { data: authData, error: authError } = await privilegedClient.auth.signUp({
        email,
        password,
        options: {
          data: { name: fullName, class: studentClass, cicno }
        }
      });

      if (authError && !authError.message.toLowerCase().includes('already registered')) {
        return { success: false, error: `Auth signup failed: ${authError.message}` };
      }
      if (authData?.user) {
        authUserId = authData.user.id;
        wasNewlyCreatedAuth = true;
      }
    }

    try {
      // Insert profile
      if (authUserId) {
        const { error: pErr } = await privilegedClient
          .from('profiles')
          .upsert({
            id: authUserId,
            role: 'student',
            designation: fullName
          }, { onConflict: 'id' });

        if (pErr) throw new Error(`Profile creation error: ${pErr.message}`);
      }

      // Insert student
      const { data: sData, error: sErr } = await privilegedClient
        .from('students')
        .upsert({
          cicno,
          name: fullName,
          class: studentClass,
          batch,
          number: phone
        }, { onConflict: 'cicno' })
        .select()
        .single();

      if (sErr) throw new Error(`Student record error: ${sErr.message}`);

      return {
        success: true,
        data: sData,
        authCreated: !!authUserId,
        email,
        password
      };
    } catch (dbErr: any) {
      // Rollback Auth user if newly created
      if (wasNewlyCreatedAuth && authUserId && isAdmin) {
        try {
          await privilegedClient.auth.admin.deleteUser(authUserId);
        } catch (e) {}
      }
      return {
        success: false,
        error: `Database registration failed: ${dbErr.message}. Auth account rolled back.`
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to complete student enrollment' };
  }
}

export async function createBulkStudents(rows: StudentInput[]) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized: Session expired', created: 0, records: [] };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isEdu = profile?.role === 'eduleader' || profile?.role === 'clgleader';
    if (!profile || !isEdu) {
      return { success: false, error: 'Unauthorized role', created: 0, records: [] };
    }

    // =========================================================================
    // STEP 1: PRE-VALIDATE ALL ROWS IN THE BATCH
    // If ANY row is invalid or has duplicates, reject immediately before touching DB!
    // =========================================================================
    if (!rows || rows.length === 0) {
      return { success: false, error: 'No student data provided in upload.', created: 0, records: [] };
    }

    const seenCicnos = new Set<string>();
    const formattedRows: StudentInput[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = (r.name || '').trim().toUpperCase();
      const cicno = (r.cicno || '').trim();
      const sClass = (r.class || '').trim();

      if (!name) {
        return { 
          success: false, 
          error: `Row ${i + 1}: Student Name is missing. The entire batch was cancelled and 0 students were added.`, 
          created: 0, 
          records: [] 
        };
      }
      if (!cicno) {
        return { 
          success: false, 
          error: `Row ${i + 1} (${name}): CIC Number is missing. The entire batch was cancelled and 0 students were added.`, 
          created: 0, 
          records: [] 
        };
      }
      if (!sClass) {
        return { 
          success: false, 
          error: `Row ${i + 1} (${name} - ${cicno}): Class is missing. The entire batch was cancelled and 0 students were added.`, 
          created: 0, 
          records: [] 
        };
      }

      if (seenCicnos.has(cicno.toLowerCase())) {
        return { 
          success: false, 
          error: `Row ${i + 1}: Duplicate CIC Number "${cicno}" found within this batch. The entire batch was cancelled and 0 students were added.`, 
          created: 0, 
          records: [] 
        };
      }
      seenCicnos.add(cicno.toLowerCase());

      formattedRows.push({
        name,
        cicno,
        class: sClass,
        batch: r.batch ? r.batch.trim() : null,
        number: r.number ? r.number : null
      });
    }

    const { client: privilegedClient } = getPrivilegedClient();

    // =========================================================================
    // STEP 2: TRY ATOMIC DATABASE BATCH TRANSACTION (PostgreSQL RPC)
    // Runs inside a single PostgreSQL transaction: if ANY row fails, ALL are rolled back!
    // =========================================================================
    const { data: batchData, error: batchError } = await privilegedClient.rpc('register_students_batch_atomic', {
      p_students: formattedRows
    });

    if (!batchError && batchData?.success) {
      return {
        success: true,
        created: batchData.count,
        records: batchData.records || []
      };
    }

    if (batchError && !batchError.message.includes('function public.register_students_batch_atomic')) {
      // The RPC exists and reported a failure that aborted the whole transaction
      return {
        success: false,
        error: `Batch cancelled: ${batchError.message}. Zero students were added.`,
        created: 0,
        records: []
      };
    }

    // =========================================================================
    // STEP 3: FALLBACK TO ALL-OR-NOTHING SEQUENTIAL EXECUTION WITH STRICT ROLLBACK
    // =========================================================================
    const createdRecords: any[] = [];
    const createdCicnos: string[] = [];

    for (let i = 0; i < formattedRows.length; i++) {
      const row = formattedRows[i];
      const res = await createSingleStudent(row);

      if (!res.success) {
        // ROLLBACK ALL PREVIOUSLY CREATED STUDENTS IN THIS BATCH!
        for (const rollbackCic of createdCicnos) {
          try {
            await deleteStudent(rollbackCic);
          } catch (e) {}
        }

        return {
          success: false,
          error: `Failed on Student ${i + 1} (${row.name} - ${row.cicno}): ${res.error}. The entire batch has been cancelled and all ${createdRecords.length} previously created accounts in this upload were rolled back. Zero students were added.`,
          created: 0,
          records: []
        };
      }

      createdRecords.push(res.data);
      createdCicnos.push(row.cicno);
    }

    return {
      success: true,
      created: createdRecords.length,
      records: createdRecords
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Batch upload failed', created: 0, records: [] };
  }
}

export async function deleteStudent(cicno: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isEdu = profile?.role === 'eduleader' || profile?.role === 'clgleader';
    if (!profile || !isEdu) {
      return { success: false, error: 'Unauthorized' };
    }

    const { client: privilegedClient, isAdmin } = getPrivilegedClient();

    // 1. Delete from students table
    const { error: sErr } = await privilegedClient
      .from('students')
      .delete()
      .eq('cicno', cicno);

    if (sErr) {
      return { success: false, error: sErr.message };
    }

    // 2. Delete Auth account and profile if admin available
    if (isAdmin) {
      const email = `${cicno.toLowerCase()}@campus.com`;
      const { data: listData } = await privilegedClient.auth.admin.listUsers();
      const authUser = listData?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (authUser) {
        await privilegedClient.from('profiles').delete().eq('id', authUser.id);
        await privilegedClient.auth.admin.deleteUser(authUser.id);
      }
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete student' };
  }
}
