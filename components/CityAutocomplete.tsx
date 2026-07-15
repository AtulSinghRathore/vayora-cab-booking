"use client";

import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export type CitySuggestion = {
  id: string;
  city: string;
  state: string;
  displayName: string;
  lat: number;
  lon: number;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: CitySuggestion) => void;
};

export default function CityAutocomplete({ value, onChange, onSelect }: Props) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = response.ok ? ((await response.json()) as CitySuggestion[]) : [];
        setSuggestions(data);
        setActiveIndex(data.length ? 0 : -1);
        setOpen(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  function choose(suggestion: CitySuggestion) {
    onSelect(suggestion);
    setOpen(false);
    setSuggestions([]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="autocomplete" ref={containerRef}>
      <input
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue);
          if (nextValue.trim().length < 2) {
            setSuggestions([]);
            setLoading(false);
          }
          setOpen(true);
        }}
        onFocus={() => suggestions.length && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Type any Indian city"
        aria-label="Destination"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        autoComplete="off"
        required
      />
      {open && (loading || suggestions.length > 0) && (
        <div className="city-suggestions" id={listboxId} role="listbox" aria-label="Indian cities">
          {loading && <p className="suggestion-status">Finding cities…</p>}
          {!loading && suggestions.map((suggestion, index) => (
            <button
              className={index === activeIndex ? "active" : ""}
              key={suggestion.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
            >
              <span>{suggestion.city}</span>
              <small>{suggestion.state || "India"}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
