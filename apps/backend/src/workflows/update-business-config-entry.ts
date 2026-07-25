import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { BUSINESS_CONFIG_MODULE } from "../modules/business-config"
import type BusinessConfigModuleService from "../modules/business-config/service"
import type { BusinessConfigCategory } from "../modules/business-config/defaults"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * Every business-config write is audit-logged (docs/SECURITY.md §12) - same
 * atomicity pattern as category create/update/delete. Creates the row if it
 * doesn't exist yet (the value was previously only a code-level default,
 * see business-config/defaults.ts), otherwise updates it in place.
 */

type UpsertValueInput = {
  category: BusinessConfigCategory
  key: string
  value: unknown
  valueType: "integer" | "boolean" | "string" | "json"
  label: string
  isPlaceholder: boolean
  isSensitive: boolean
  updatedBy: string
}

const upsertConfigValueStep = createStep(
  "upsert-config-value",
  async (input: UpsertValueInput, { container }) => {
    const businessConfigModuleService: BusinessConfigModuleService = container.resolve(
      BUSINESS_CONFIG_MODULE
    )
    const [existing] = await businessConfigModuleService.listBusinessConfigEntries({
      category: input.category,
      key: input.key,
    })

    const previousValue = existing ? existing.value : undefined

    // model.json() infers an object-shaped TS type; jsonb genuinely stores
    // any JSON value (number/boolean/string/array included), so this cast
    // is a deliberate widening, not a type error.
    const jsonValue = input.value as Record<string, unknown>

    const row = existing
      ? await businessConfigModuleService.updateBusinessConfigEntries({
          id: existing.id,
          value: jsonValue,
          updated_by: input.updatedBy,
        })
      : await businessConfigModuleService.createBusinessConfigEntries({
          category: input.category,
          key: input.key,
          value: jsonValue,
          value_type: input.valueType,
          label: input.label,
          is_placeholder: input.isPlaceholder,
          is_sensitive: input.isSensitive,
          updated_by: input.updatedBy,
        })

    return new StepResponse(row, {
      id: existing?.id ?? row.id,
      existed: Boolean(existing),
      previousValue,
    })
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const businessConfigModuleService: BusinessConfigModuleService = container.resolve(
      BUSINESS_CONFIG_MODULE
    )
    if (compensationInput.existed) {
      await businessConfigModuleService.updateBusinessConfigEntries({
        id: compensationInput.id,
        value: compensationInput.previousValue as Record<string, unknown>,
      })
    } else {
      await businessConfigModuleService.deleteBusinessConfigEntries([compensationInput.id])
    }
  }
)

type RecordAuditLogInput = {
  adminUserId: string
  category: BusinessConfigCategory
  key: string
  before: unknown
  after: unknown
}

const recordConfigChangeAuditLogStep = createStep(
  "record-config-change-audit-log",
  async (input: RecordAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "business_config.updated",
      entityType: "business_config_entry",
      entityId: `${input.category}:${input.key}`,
      beforeState: { value: input.before },
      afterState: { value: input.after },
    })
    return new StepResponse(auditLog)
  }
)

export type UpdateBusinessConfigEntryWorkflowInput = {
  adminUserId: string
  category: BusinessConfigCategory
  key: string
  value: unknown
  valueType: "integer" | "boolean" | "string" | "json"
  label: string
  isPlaceholder: boolean
  isSensitive: boolean
  previousValueForAudit: unknown
}

export const updateBusinessConfigEntryWorkflowId = "update-business-config-entry"

export const updateBusinessConfigEntryWorkflow = createWorkflow(
  updateBusinessConfigEntryWorkflowId,
  (input: UpdateBusinessConfigEntryWorkflowInput) => {
    const entry = upsertConfigValueStep({
      category: input.category,
      key: input.key,
      value: input.value,
      valueType: input.valueType,
      label: input.label,
      isPlaceholder: input.isPlaceholder,
      isSensitive: input.isSensitive,
      updatedBy: input.adminUserId,
    })

    recordConfigChangeAuditLogStep({
      adminUserId: input.adminUserId,
      category: input.category,
      key: input.key,
      before: input.previousValueForAudit,
      after: input.value,
    })

    return new WorkflowResponse({ entry })
  }
)
