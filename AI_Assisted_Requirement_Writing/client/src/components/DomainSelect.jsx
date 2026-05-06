import React from "react";
import { GraduationCap, HeartPulse, Landmark, Monitor, ShoppingCart, Sparkles } from "lucide-react";
import "./DomainSelect.css";

export const DOMAIN_OPTIONS = [
  {
    id: "healthcare",
    name: "Healthcare",
    subtitle: "Clinical systems, HIPAA, patient workflows",
    icon: HeartPulse,
  },
  {
    id: "finance",
    name: "Finance",
    subtitle: "Banking, payments, compliance & risk",
    icon: Landmark,
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    subtitle: "Catalogs, carts, checkout & fulfillment",
    icon: ShoppingCart,
  },
  {
    id: "education",
    name: "Education",
    subtitle: "LMS, courses, assessments & reporting",
    icon: GraduationCap,
  },
  {
    id: "technology",
    name: "Technology",
    subtitle: "SaaS, APIs, platforms & integrations",
    icon: Monitor,
  },
  {
    id: "custom",
    name: "Custom",
    subtitle: "Define your own domain context",
    icon: Sparkles,
  },
];

/**
 * @param {object} props
 * @param {string | null} props.selectedDomain — domain id or null
 * @param {(id: string) => void} props.onSelect
 * @param {() => void} props.onContinue
 */
const DomainSelect = ({ selectedDomain, onSelect, onContinue }) => {
  return (
    <div className="domain-select">
      <p className="domain-select__intro">
        Pick a domain so we can tailor requirement wording and categories.
      </p>
      <div className="domain-grid" role="list">
        {DOMAIN_OPTIONS.map((d) => {
          const isSelected = selectedDomain === d.id;
          const Icon = d.icon;
          return (
            <button
              key={d.id}
              type="button"
              role="listitem"
              className={`domain-card${isSelected ? " domain-card--selected" : ""}`}
              onClick={() => onSelect(d.id)}
              aria-pressed={isSelected}
              aria-label={`${d.name}. ${d.subtitle}`}
            >
              <span className="domain-card__icon" aria-hidden>
                <Icon size={20} />
              </span>
              <span className="domain-card__name">{d.name}</span>
              <span className="domain-card__subtitle">{d.subtitle}</span>
            </button>
          );
        })}
      </div>
      <div className="domain-select__actions">
        <button type="button" className="domain-continue" onClick={onContinue}>
          {selectedDomain ? "Continue" : "Skip and Auto-Detect"}
        </button>
      </div>
    </div>
  );
};

export default DomainSelect;
