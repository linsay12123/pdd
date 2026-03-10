import { describe, expect, it } from "vitest";

import {
  buildWorkflowMetadataSelect,
  resolveWorkflowMetadataColumnAvailability,
  stripUnavailableWorkflowMetadata
} from "../../src/lib/tasks/workflow-stage-timestamps";

describe("workflow metadata column fallback", () => {
  it("drops only workflow_error_message when that column is missing", () => {
    const availability = resolveWorkflowMetadataColumnAvailability(
      new Error('column "workflow_error_message" does not exist')
    );

    expect(availability).toEqual({
      missingWorkflowStageTimestamps: false,
      missingWorkflowErrorMessage: true
    });
    expect(
      stripUnavailableWorkflowMetadata(
        {
          workflow_stage_timestamps: { drafting: "2026-03-10T00:00:00.000Z" },
          workflow_error_message: "boom",
          status: "failed"
        },
        availability
      )
    ).toEqual({
      workflow_stage_timestamps: { drafting: "2026-03-10T00:00:00.000Z" },
      status: "failed"
    });
    expect(buildWorkflowMetadataSelect("status", availability)).toBe(
      "status,workflow_stage_timestamps"
    );
  });

  it("drops only workflow_stage_timestamps when that column is missing", () => {
    const availability = resolveWorkflowMetadataColumnAvailability(
      new Error('column "workflow_stage_timestamps" does not exist')
    );

    expect(availability).toEqual({
      missingWorkflowStageTimestamps: true,
      missingWorkflowErrorMessage: false
    });
    expect(
      stripUnavailableWorkflowMetadata(
        {
          workflow_stage_timestamps: { drafting: "2026-03-10T00:00:00.000Z" },
          workflow_error_message: "boom",
          status: "failed"
        },
        availability
      )
    ).toEqual({
      workflow_error_message: "boom",
      status: "failed"
    });
    expect(buildWorkflowMetadataSelect("status", availability)).toBe(
      "status,workflow_error_message"
    );
  });
});
