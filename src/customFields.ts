import { z } from "zod";

/**
 * Values Testmo accepts for repository case custom fields: dropdown option ID (number),
 * multiselect option IDs (number[]), text/HTML (string), checkbox (boolean), or null to clear.
 */
const customFieldValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.number(), z.string()])),
  z.null(),
]);

export const customFieldsSchema = z
  .record(
    z
      .string()
      .regex(
        /^custom_[a-z0-9_]+$/,
        "keys must be custom field column names, e.g. custom_automation_type"
      ),
    customFieldValue
  )
  .optional()
  .describe(
    "Any other case custom fields, keyed by column name (`custom_<system_name>` from get_fields), e.g. " +
      '{"custom_automation_type": 23, "custom_test_categories": [28], "custom_auto_test_id": "EC-01001", ' +
      '"custom_read_only": false}. Dropdown = option ID, multiselect = array of option IDs. ' +
      "Named parameters of this tool win over the same key here."
  );

export const priorityOptionSchema = z
  .number()
  .int()
  .positive()
  .optional()
  .describe(
    "Priority dropdown option ID. Option IDs are per instance — check get_fields (Priority field); " +
      "a default Testmo setup uses 1=critical, 2=high, 3=medium, 4=low."
  );

/** Merges `custom_fields` into the request body; explicitly named fields take precedence. */
export function withCustomFields<T extends { custom_fields?: Record<string, unknown> }>(
  input: T
): Omit<T, "custom_fields"> & Record<string, unknown> {
  const { custom_fields, ...fields } = input;
  return { ...(custom_fields ?? {}), ...fields };
}
