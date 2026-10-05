
"use client";

import type { MouseEvent } from "react";

export default function Footer() {
  const handleOpenPrivacy = (
    event: MouseEvent<HTMLAnchorElement>
  ) => {
    event.preventDefault();

    const modalElement =
      document.getElementById(
        "dataPrivacyModal"
      );

    if (
      modalElement &&
      typeof window !== "undefined" &&
      (window as any).bootstrap
    ) {
      const modal =
        (window as any).bootstrap.Modal.getOrCreateInstance(
          modalElement
        );

      modal.show();
    }
  };

  return (
    <footer
      className="app-footer py-3 text-center border-top border-secondary mt-auto"
      style={{
        width: "100%",
      }}
    >
      <div className="text-light small fw-semibold px-3">
        &copy; 2026 Filamer Christian University, Inc. –
        <b>C</b>entralized{" "}
        <b>L</b>iquidation of{" "}
        <b>E</b>xpenses &{" "}
        <b>A</b>udit{" "}
        <b>R</b>ecords
      </div>

      <div
        className="text-accent small px-3"
        style={{
          fontSize: "0.75rem",
        }}
      >
        All rights reserved • Designed & Developed by{" "}

        <a
          href="https://www.facebook.com/engrkenmark"
          target="_blank"
          rel="noopener noreferrer"
          className="text-info text-decoration-none"
        >
          Engr. Bulquerin
        </a>

        {" • "}

        <a
          href="#privacy"
          onClick={
            handleOpenPrivacy
          }
          className="text-secondary text-decoration-underline"
          style={{
            cursor: "pointer",
          }}
        >
          Privacy Notice
        </a>
      </div>
    </footer>
  );
}
