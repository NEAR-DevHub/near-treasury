"use client";

import { useState } from "react";

const FAQAccordion = ({ question, answer, isOpen, onToggle, isLast }) => {
  return (
    <div>
      <div
        className={`faq-question d-flex justify-content-between align-items-center ${
          isOpen ? "expanded" : ""
        } ${isLast ? "last-child" : ""}`}
        onClick={onToggle}
      >
        <div className="fw-bold">{question}</div>
        <i className={`bi bi-chevron-${isOpen ? "up" : "down"}`}></i>
      </div>
      <div className={`faq-answer ${isOpen ? "expanded" : ""}`}>
        <div className="text-secondary" style={{ whiteSpace: "pre-line" }}>
          {answer}
        </div>
      </div>
    </div>
  );
};

const FAQSection = ({ faqItems = [] }) => {
  const [openItems, setOpenItems] = useState(new Set());

  const toggleItem = (index) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index);
    } else {
      newOpenItems.add(index);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <div
      className="border border-1 rounded-4 p-3"
      style={{ backgroundColor: "var(--grey-05)" }}
    >
      <div className="h5 fw-bold mb-0">FAQ</div>
      {faqItems.map((item, index) => (
        <FAQAccordion
          key={index}
          question={item.question}
          answer={item.answer}
          isOpen={openItems.has(index)}
          onToggle={() => toggleItem(index)}
          isLast={index === faqItems.length - 1}
        />
      ))}
    </div>
  );
};

export default FAQSection;
