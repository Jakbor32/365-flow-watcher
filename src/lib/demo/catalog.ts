// Fictional building blocks for the demo tenant. Contoso is Microsoft's own
// placeholder company, so none of this maps to a real organisation.

export const DEMO_DOMAIN = "contoso.com";

export const DEPARTMENTS = [
  "Finance",
  "HR",
  "IT",
  "Operations",
  "Procurement",
  "Communications",
  "Legal",
  "Programs",
] as const;

export const PEOPLE = [
  "Adele Vance",
  "Alex Wilber",
  "Diego Siciliani",
  "Grady Archie",
  "Henrietta Mueller",
  "Isaiah Langer",
  "Johanna Lorenz",
  "Joni Sherman",
  "Lee Gu",
  "Lidia Holloway",
  "Lynne Robbins",
  "Megan Bowen",
  "Miriam Graham",
  "Nestor Wilke",
  "Patti Fernandez",
  "Pradeep Gupta",
  "Emily Braun",
  "Christie Cline",
  "Enrico Cattaneo",
  "Irvin Sayers",
  "Allan Deyoung",
  "Debra Berger",
] as const;

/** Shared service accounts that usually own production flows. */
export const SERVICE_ACCOUNTS = ["svc-automation", "svc-finance-flows", "svc-hr-flows"] as const;

export interface FlowTemplate {
  name: string;
  kind: "recurrence" | "automated" | "instant";
  trigger: string;
  connectors: string[];
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    name: "Invoice approval",
    kind: "automated",
    trigger: "When a file is created in a folder",
    connectors: ["SharePoint", "Approvals", "Outlook"],
  },
  {
    name: "Purchase order sync",
    kind: "recurrence",
    trigger: "Every 1 hour",
    connectors: ["SQL Server", "Dataverse"],
  },
  {
    name: "New hire onboarding",
    kind: "automated",
    trigger: "When an item is created",
    connectors: ["SharePoint", "Office 365 Users", "Planner", "Teams"],
  },
  {
    name: "Offboarding checklist",
    kind: "automated",
    trigger: "When an item is modified",
    connectors: ["SharePoint", "Planner", "Outlook"],
  },
  {
    name: "Leave request approval",
    kind: "automated",
    trigger: "When a response is submitted",
    connectors: ["Forms", "Approvals", "Outlook"],
  },
  {
    name: "Daily sales digest",
    kind: "recurrence",
    trigger: "Every day at 07:00",
    connectors: ["Dataverse", "Outlook"],
  },
  {
    name: "Contract expiry reminder",
    kind: "recurrence",
    trigger: "Every day at 08:00",
    connectors: ["SharePoint", "Outlook", "Teams"],
  },
  {
    name: "Ticket triage",
    kind: "automated",
    trigger: "When a new email arrives",
    connectors: ["Outlook", "Dataverse", "Teams"],
  },
  {
    name: "Expense report routing",
    kind: "automated",
    trigger: "When a file is created",
    connectors: ["OneDrive", "Approvals", "Excel Online"],
  },
  {
    name: "Weekly KPI export",
    kind: "recurrence",
    trigger: "Every Monday at 06:00",
    connectors: ["Dataverse", "Excel Online", "SharePoint"],
  },
  {
    name: "Guest access review",
    kind: "recurrence",
    trigger: "Every 1 week",
    connectors: ["Microsoft Graph", "Approvals", "Teams"],
  },
  {
    name: "Donor receipt mailer",
    kind: "automated",
    trigger: "When a row is added",
    connectors: ["Dataverse", "Word Online", "Outlook"],
  },
  {
    name: "Travel request",
    kind: "instant",
    trigger: "Manually trigger a flow",
    connectors: ["Forms", "Approvals", "SharePoint"],
  },
  {
    name: "Asset inventory sync",
    kind: "recurrence",
    trigger: "Every 6 hours",
    connectors: ["HTTP", "SharePoint"],
  },
  {
    name: "Meeting room cleanup",
    kind: "recurrence",
    trigger: "Every day at 22:00",
    connectors: ["Outlook", "Teams"],
  },
  {
    name: "Document archive",
    kind: "recurrence",
    trigger: "Every 1 month",
    connectors: ["SharePoint", "OneDrive"],
  },
  {
    name: "Vendor onboarding",
    kind: "automated",
    trigger: "When an item is created",
    connectors: ["SharePoint", "Approvals", "Dataverse"],
  },
  {
    name: "Press mention alert",
    kind: "recurrence",
    trigger: "Every 1 hour",
    connectors: ["RSS", "Teams"],
  },
  {
    name: "License usage report",
    kind: "recurrence",
    trigger: "Every 1 week",
    connectors: ["Microsoft Graph", "Excel Online", "Outlook"],
  },
  {
    name: "Timesheet reminder",
    kind: "recurrence",
    trigger: "Every Friday at 14:00",
    connectors: ["Office 365 Users", "Teams"],
  },
  {
    name: "Budget variance check",
    kind: "recurrence",
    trigger: "Every day at 09:00",
    connectors: ["SQL Server", "Outlook"],
  },
  {
    name: "Form to list",
    kind: "automated",
    trigger: "When a response is submitted",
    connectors: ["Forms", "SharePoint"],
  },
  {
    name: "Teams channel provisioning",
    kind: "instant",
    trigger: "For a selected item",
    connectors: ["SharePoint", "Teams", "Microsoft Graph"],
  },
  {
    name: "Password expiry notice",
    kind: "recurrence",
    trigger: "Every day at 06:30",
    connectors: ["Microsoft Graph", "Outlook"],
  },
  {
    name: "Grant report collector",
    kind: "automated",
    trigger: "When a file is created",
    connectors: ["SharePoint", "Approvals", "Teams"],
  },
];

export const SUFFIXES = [
  "",
  " v2",
  " (prod)",
  " - EU",
  " - backup",
  " (test)",
  " - legacy",
] as const;

export interface ErrorTemplate {
  code: string;
  message: string;
  action: string;
  /** Connector that must be used by the flow for this error to make sense. */
  connector?: string;
}

export const ERRORS: ErrorTemplate[] = [
  {
    code: "ConnectionAuthorizationFailed",
    message:
      "The caller with object id does not have permission for connection 'shared_sharepointonline'. Re-authenticate the connection.",
    action: "Get_items",
    connector: "SharePoint",
  },
  {
    code: "InvalidTemplate",
    message:
      "Unable to process template language expressions in action 'Compose_body'. The property 'value' doesn't exist, available properties are 'id, title'.",
    action: "Compose_body",
  },
  {
    code: "TooManyRequests",
    message: "Rate limit is exceeded. Try again in 24 seconds.",
    action: "Send_an_email_(V2)",
    connector: "Outlook",
  },
  {
    code: "NotFound",
    message: "Item Not Found. The item may have been deleted or moved.",
    action: "Get_item",
    connector: "SharePoint",
  },
  {
    code: "ActionFailed",
    message: "An action failed. No dependent actions succeeded.",
    action: "Apply_to_each",
  },
  {
    code: "GatewayTimeout",
    message: "The request timed out after 120 seconds waiting for the on-premises data gateway.",
    action: "Execute_a_SQL_query",
    connector: "SQL Server",
  },
  {
    code: "BadRequest",
    message: "The response is not in a JSON format. Cannot read server response.",
    action: "HTTP",
    connector: "HTTP",
  },
  {
    code: "RecordNotFound",
    message: "Entity 'account' with id was not found in Dataverse.",
    action: "Get_a_row_by_ID",
    connector: "Dataverse",
  },
  {
    code: "Forbidden",
    message:
      "Access denied. The user or app does not have the required role to perform this operation.",
    action: "Create_team",
    connector: "Microsoft Graph",
  },
  {
    code: "MailboxNotFound",
    message:
      "The specified mailbox could not be found. It may have been deleted or its license removed.",
    action: "Send_an_email_(V2)",
    connector: "Outlook",
  },
];

/** What a flow owned by a disabled/deleted account fails with. */
export const ORPHAN_ERROR: ErrorTemplate = {
  code: "ConnectionAuthorizationFailed",
  message:
    "The connection owner's account is disabled. Sign in with an active account to fix the connection.",
  action: "Initialize_connection",
};
