"use client";

import React, { useState, useRef, useEffect } from "react";

export interface DropdownItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: (DropdownItem | "divider")[];
  align?: "left" | "right";
  className?: string;
}

export function Dropdown({ trigger, items, align = "right", className = "" }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} role="button" tabIndex={0}>
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-2 w-56 rounded-xl bg-slate-900 border border-slate-750 shadow-2xl shadow-black/80 py-1.5 z-50 animate-scale-up`}
        >
          {items.map((item, index) => {
            if (item === "divider") {
              return <div key={`divider-${index}`} className="my-1 border-t border-slate-800" />;
            }
            return (
              <button
                key={item.key}
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick?.();
                    setIsOpen(false);
                  }
                }}
                className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center gap-2.5 transition-colors ${
                  item.destructive
                    ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    : "text-slate-200 hover:bg-slate-800 hover:text-white"
                } ${item.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {item.icon && <span className="text-slate-400 shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ content, children, position = "top", className = "" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2"
  }[position];

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`absolute ${positionClasses} z-50 px-2.5 py-1 text-[11px] font-medium text-slate-100 bg-slate-950/95 border border-slate-750 rounded-md shadow-xl whitespace-nowrap pointer-events-none transition-opacity animate-fade-in`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = "" }: TabsProps) {
  return (
    <div className={`flex items-center gap-1.5 p-1 bg-slate-950/60 border border-slate-800/80 rounded-xl backdrop-blur-md ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
              isActive
                ? "bg-slate-800 text-white shadow-sm border border-slate-700/80"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? "bg-blue-500/20 text-blue-300" : "bg-slate-800 text-slate-400"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
