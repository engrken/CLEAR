/** Resolve the saved school identity and the separate tenant college/department.
 * No hard-coded school or global institution identity is used. */
export interface ReceiptBrandingInput {
  name: string;
  reportSchoolName?: string | null;
  reportSchoolAddress?: string | null;
}

export function resolveReceiptBranding(source: ReceiptBrandingInput) {
  const organizationName = source.name.trim();
  const configuredSchoolName = source.reportSchoolName?.trim() ?? "";
  const schoolName = configuredSchoolName || organizationName;
  const schoolAddress = source.reportSchoolAddress?.trim() ?? "";

  return {
    schoolName,
    organizationName,
    schoolAddress,
    configuredSchoolName: Boolean(configuredSchoolName),
    showOrganizationLine: Boolean(
      configuredSchoolName &&
      configuredSchoolName.toLocaleLowerCase("en") !==
        organizationName.toLocaleLowerCase("en")
    ),
  };
}
