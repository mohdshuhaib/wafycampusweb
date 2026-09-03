'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function Select({ value, onChange, options, placeholder = 'Select...', className = '', required }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {required && <input type="text" className="absolute opacity-0 w-0 h-0" required value={value} onChange={() => {}} />}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-card text-foreground border border-input rounded-md text-sm shadow-xs outline-none focus:ring-2 focus:ring-ring transition-colors text-left"
      >
        <span className={selectedOption ? 'text-foreground font-medium' : 'text-muted-foreground'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-popover text-popover-foreground border border-border rounded-md shadow-md max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {options.length === 0 ? (
            <div className="p-3 text-muted-foreground text-sm text-center">No options available</div>
          ) : (
            <ul className="p-1">
              {options.map((opt, idx) => (
                <li
                  key={idx}
                  className={`px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-sm font-medium ${
                    opt.disabled 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-accent hover:text-accent-foreground text-foreground'
                  } ${value === opt.value ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                  onClick={() => {
                    if (!opt.disabled) {
                      onChange(opt.value);
                      setIsOpen(false);
                    }
                  }}
                >
                  {opt.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
