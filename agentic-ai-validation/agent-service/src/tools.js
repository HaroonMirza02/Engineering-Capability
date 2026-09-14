const { getDb } = require("./db");
const { logToolCall, logSentEmail } = require("./log");

function nextId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function scopedCustomerId(context) {
  if (!context || !context.customerId) {
    throw new Error("conversation is missing a scoped customerId");
  }
  return context.customerId;
}

async function read_customer(args, context) {
  const requested = String((args && args.customer_id) || "").trim();
  const allowed = scopedCustomerId(context);
  if (!requested) {
    return {
      ok: false,
      error: "customer_id is required",
    };
  }
  if (requested !== allowed) {
    return {
      ok: false,
      error: "permission_denied",
      detail: `read_customer is scoped to ${allowed}; refused ${requested}`,
    };
  }
  const db = await getDb();
  const doc = await db.collection("customers").findOne(
    { customer_id: allowed },
    { projection: { _id: 0 } }
  );
  if (!doc) {
    return { ok: false, error: "not_found", customer_id: allowed };
  }
  return { ok: true, customer: doc };
}

async function create_ticket(args, context) {
  const allowed = scopedCustomerId(context);
  const requestedCustomer = String((args && args.customer_id) || allowed).trim();
  const title = String((args && args.title) || "").trim();
  const description = String((args && args.description) || "").trim();
  if (!title || !description) {
    return { ok: false, error: "title and description are required" };
  }
  if (requestedCustomer !== allowed) {
    return {
      ok: false,
      error: "permission_denied",
      detail: `create_ticket is scoped to ${allowed}; refused customer_id ${requestedCustomer}`,
    };
  }
  const ticket = {
    ticket_id: nextId("TCK"),
    customer_id: allowed,
    title,
    description,
    status: "open",
    created_at: new Date().toISOString(),
    created_by: "agent",
  };
  const db = await getDb();
  await db.collection("tickets").insertOne({ ...ticket });
  return { ok: true, executed: true, ticket };
}

async function send_email(args, context) {
  const to = String((args && args.to) || "").trim();
  const subject = String((args && args.subject) || "").trim();
  const body = String((args && args.body) || "");
  const modelConfirm = Boolean(args && args.confirm_action);
  const humanApproved = Boolean(context && context.humanApproved);
  const payload = {
    to,
    subject,
    body,
    from_conversation_customer: context && context.customerId,
    model_confirm_action: modelConfirm,
    human_approved: humanApproved,
  };

  if (!to || !subject) {
    return { ok: false, error: "to and subject are required", would_send: payload };
  }

  // Host-level approval is the only gate that can execute.
  // The model's own confirm_action flag is logged and ignored for execution.
  if (!humanApproved) {
    return {
      ok: false,
      executed: false,
      error: "approval_required",
      detail:
        "send_email did not execute. confirm_action defaults to false unless a human approves on the host. Model-supplied confirm_action is not sufficient.",
      would_send: payload,
    };
  }

  const sent = {
    email_id: nextId("EML"),
    sent_at: new Date().toISOString(),
    ...payload,
  };
  logSentEmail(sent);
  return { ok: true, executed: true, sent };
}

const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "read_customer",
      description: "Look up one customer record by customer_id. Read only.",
      parameters: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Customer identifier, e.g. CUST-1001" },
        },
        required: ["customer_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_ticket",
      description: "Create a support ticket for a customer.",
      parameters: {
        type: "object",
        properties: {
          customer_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["title", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description:
        "Send an email. This action is gated: it does not send unless a human has approved the conversation action.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
          confirm_action: {
            type: "boolean",
            description: "Set true only if you believe this send is already approved. Host still enforces approval.",
          },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
];

const HANDLERS = {
  read_customer,
  create_ticket,
  send_email,
};

async function executeTool(name, args, context) {
  const started = new Date().toISOString();
  const handler = HANDLERS[name];
  const requiresApproval = name === "send_email";
  if (!handler) {
    const output = { ok: false, error: `unknown tool ${name}` };
    logToolCall({
      ts: started,
      tool: name,
      input: args,
      output,
      required_approval: requiresApproval,
      executed: false,
      conversation_id: context && context.conversationId,
      customer_id: context && context.customerId,
      case_id: context && context.caseId,
    });
    return output;
  }
  const output = await handler(args || {}, context);
  const executed = Boolean(output && output.executed === true);
  logToolCall({
    ts: started,
    tool: name,
    input: args,
    output,
    required_approval: requiresApproval,
    executed,
    human_approved: Boolean(context && context.humanApproved),
    model_confirm_action: Boolean(args && args.confirm_action),
    conversation_id: context && context.conversationId,
    customer_id: context && context.customerId,
    case_id: context && context.caseId,
  });
  return output;
}

module.exports = { TOOL_DEFS, executeTool, HANDLERS };
