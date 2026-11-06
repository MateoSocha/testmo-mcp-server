import { describe, expect, it } from "vitest";
import {
  customFieldsSchema,
  priorityOptionSchema,
  withCustomFields,
} from "../../src/customFields.js";

describe("withCustomFields", () => {
  it("merges custom_fields into the body and drops the custom_fields key", () => {
    const body = withCustomFields({
      name: "Case",
      custom_fields: { custom_automation_type: 23, custom_test_categories: [28] },
    });
    expect(body).toEqual({
      name: "Case",
      custom_automation_type: 23,
      custom_test_categories: [28],
    });
    expect(body).not.toHaveProperty("custom_fields");
  });

  it("lets named fields win over the same key in custom_fields", () => {
    const body = withCustomFields({ custom_priority: 53, custom_fields: { custom_priority: 1 } });
    expect(body.custom_priority).toBe(53);
  });

  it("works without custom_fields", () => {
    expect(withCustomFields({ name: "Case" })).toEqual({ name: "Case" });
  });
});

describe("customFieldsSchema", () => {
  it("accepts dropdown, multiselect, text, checkbox and null values", () => {
    const parsed = customFieldsSchema.parse({
      custom_automation_type: 23,
      custom_api_service: [40, 55],
      custom_auto_test_id: "EC-01001",
      custom_read_only: false,
      custom_test_data: null,
    });
    expect(parsed?.custom_api_service).toEqual([40, 55]);
  });

  it("rejects keys that are not custom field column names", () => {
    expect(() => customFieldsSchema.parse({ name: "x" })).toThrow();
    expect(() => customFieldsSchema.parse({ "custom-Field": 1 })).toThrow();
  });
});

describe("priorityOptionSchema", () => {
  it("accepts instance-specific option IDs such as 53", () => {
    expect(priorityOptionSchema.parse(53)).toBe(53);
  });

  it("rejects zero and negative values", () => {
    expect(() => priorityOptionSchema.parse(0)).toThrow();
    expect(() => priorityOptionSchema.parse(-1)).toThrow();
  });
});
