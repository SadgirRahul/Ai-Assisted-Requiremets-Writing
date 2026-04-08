import React from "react";
import "./DomainSelect.css";

export const DOMAIN_OPTIONS = [
  {
    id: "healthcare",
    name: "Healthcare",
    subtitle: "Clinical systems, HIPAA, patient workflows",
    icon: "🏥",
  },
  {
    id: "finance",
    name: "Finance",
    subtitle: "Banking, payments, compliance & risk",
    icon: "🏦",
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    subtitle: "Catalogs, carts, checkout & fulfillment",
    icon: "🛒",
  },
  {
    id: "education",
    name: "Education",
    subtitle: "LMS, courses, assessments & reporting",
    icon: "📚",
  },
  {
    id: "technology",
    name: "Technology",
    subtitle: "SaaS, APIs, platforms & integrations",
    icon: "💻",
  },
  {
    id: "custom",
    name: "Custom",
    subtitle: "Define your own domain context",
    icon: "✨",
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
                {d.icon}
              </span>
              <span className="domain-card__name">{d.name}</span>
              <span className="domain-card__subtitle">{d.subtitle}</span>
            </button>
          );
        })}
      </div>
      {selectedDomain ? (
        <div className="domain-select__actions">
          <button type="button" className="domain-continue" onClick={onContinue}>
            Continue
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default DomainSelect;
