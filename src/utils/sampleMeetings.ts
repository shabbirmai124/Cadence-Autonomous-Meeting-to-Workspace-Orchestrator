import type { ExtractedMeetingPlan } from '../types/meeting.ts';

export interface SampleMeetingTemplate {
  id: string;
  label: string;
  transcript: string;
  fallbackPlan: ExtractedMeetingPlan;
}

export const SAMPLE_MEETING_TEMPLATES: SampleMeetingTemplate[] = [
  {
    id: 'q4-launch',
    label: 'Q4 Product Launch Sync',
    transcript: `Meeting: Q4 Product Launch Readiness Sync
Date: November 13, 2026
Attendees: Elena Rostova (elena@acme-ops.io), Marcus Chen (marcus@acme-ops.io), Priya Nair (priya@acme-ops.io)

Elena: Thanks everyone for joining. Let's lock down our Q4 release checklist. First decision: we are freezing feature merges on November 18 so QA has a clean five-day regression window before general availability on November 25.

Marcus: Sounds good. I'll finalize the SOC2 security audit evidence packet and upload the signed compliance appendix by November 18. Can we also make sure legal signs off on the updated enterprise DPA?

Priya: Yes, I spoke with legal this morning. They want one clean redline summary. I will send the enterprise DPA redline package to legal and update the customer portal terms by November 20.

Elena: Great. Also we decided to postpone the self-serve annual billing migration to Q1 so support isn't overloaded during launch week. Marcus, please prepare the launch-day incident escalation runbook and share it with on-call leads by November 21. And someone from marketing should probably double-check the webinar timezone wording next week, though we haven't picked who yet.`,
    fallbackPlan: {
      title: 'Q4 Product Launch Readiness Sync',
      summary:
        'The team finalized the Q4 release timeline, setting a November 18 code freeze ahead of November 25 general availability. Legal DPA updates, SOC2 audit packaging, and incident runbook readiness were assigned with clear target dates, while annual billing migration was deferred to Q1.',
      keyDecisions: [
        'Freeze feature merges on November 18 for a 5-day QA regression window before GA on November 25.',
        'Postpone self-serve annual billing migration to Q1 to protect launch-week support bandwidth.',
      ],
      ambiguities: [
        'Marketing owner for verifying the webinar timezone wording was not explicitly assigned.',
      ],
      actionItems: [
        {
          task: 'Finalize SOC2 security audit evidence packet and upload signed compliance appendix',
          assignee: 'Marcus Chen',
          assigneeEmail: 'marcus@acme-ops.io',
          dueDate: '2026-11-18',
          priority: 'High',
          confidenceScore: 0.96,
          verifiedByUser: true,
          emailSubject: 'Action Required: SOC2 Audit Evidence Packet (Due Nov 18)',
          emailBody:
            'Hi Marcus,\n\nFollowing today\'s Q4 Launch Readiness Sync, please finalize the SOC2 security audit evidence packet and upload the signed compliance appendix by November 18.\n\nThanks,\nElena\n\n[AI-Assisted Draft • Verified by User]',
        },
        {
          task: 'Send enterprise DPA redline package to legal and update customer portal terms',
          assignee: 'Priya Nair',
          assigneeEmail: 'priya@acme-ops.io',
          dueDate: '2026-11-20',
          priority: 'High',
          confidenceScore: 0.93,
          verifiedByUser: true,
          emailSubject: 'Follow-up: Enterprise DPA Redline & Portal Terms (Due Nov 20)',
          emailBody:
            'Hi Priya,\n\nAs agreed in our Q4 Launch Sync, please send the enterprise DPA redline summary to legal and publish the updated portal terms by November 20.\n\nBest,\nElena\n\n[AI-Assisted Draft • Verified by User]',
        },
        {
          task: 'Prepare launch-day incident escalation runbook and distribute to on-call leads',
          assignee: 'Marcus Chen',
          assigneeEmail: 'marcus@acme-ops.io',
          dueDate: '2026-11-21',
          priority: 'Medium',
          confidenceScore: 0.89,
          verifiedByUser: true,
          emailSubject: 'Q4 Launch Runbook: Incident Escalation Prep (Due Nov 21)',
          emailBody:
            'Hi Marcus,\n\nPlease share the launch-day incident escalation runbook with all on-call leads by November 21 so everyone is aligned before code freeze wraps.\n\nBest,\nElena\n\n[AI-Assisted Draft • Verified by User]',
        },
        {
          task: 'Verify webinar timezone wording on launch registration page',
          assignee: 'Marketing Team (Unconfirmed)',
          assigneeEmail: '',
          dueDate: '2026-11-20',
          priority: 'Low',
          confidenceScore: 0.62,
          verifiedByUser: false,
          emailSubject: 'Confirmation Needed: Webinar Timezone Wording Check',
          emailBody:
            'Hi team,\n\nDuring the Q4 Launch Sync it was mentioned someone should verify the webinar timezone wording next week. Please confirm the owner and complete this check.\n\nBest,\nElena\n\n[AI-Assisted Draft • Verified by User]',
        },
      ],
    },
  },
  {
    id: 'customer-escalation',
    label: 'Northstar Enterprise Renewal Review',
    transcript: `Meeting: Northstar Logistics Renewal & Architecture Review
Attendees: David Kim (david@acme-ops.io), Hannah Brooks (hannah@acme-ops.io)

David: Northstar's CTO flagged SSO latency spikes during Monday morning shift changes. Decision: we will provision a dedicated EU-West read replica for Northstar's tenant before their renewal signature on November 24.

Hannah: I'll provision the dedicated EU-West read replica and run load verification benchmarks by November 19. 

David: I will deliver the updated SLA credit addendum and revised 24-month renewal order form to Northstar procurement by November 21.`,
    fallbackPlan: {
      title: 'Northstar Logistics Renewal & Architecture Review',
      summary:
        'Reviewed Northstar Logistics SSO latency concerns ahead of their November 24 enterprise renewal. Approved provisioning a dedicated EU-West read replica and delivering an updated SLA addendum and 24-month order form.',
      keyDecisions: [
        'Provision a dedicated EU-West read replica for the Northstar tenant prior to renewal on November 24.',
      ],
      ambiguities: [],
      actionItems: [
        {
          task: 'Provision dedicated EU-West read replica and run Monday shift load benchmarks',
          assignee: 'Hannah Brooks',
          assigneeEmail: 'hannah@acme-ops.io',
          dueDate: '2026-11-19',
          priority: 'High',
          confidenceScore: 0.95,
          verifiedByUser: true,
          emailSubject: 'Northstar Tenant: EU-West Read Replica & Benchmarks (Due Nov 19)',
          emailBody:
            'Hi Hannah,\n\nPer our Northstar review, please provision the dedicated EU-West read replica and share the load benchmark report by November 19.\n\nBest,\nDavid\n\n[AI-Assisted Draft • Verified by User]',
        },
        {
          task: 'Deliver updated SLA credit addendum and 24-month renewal order form to Northstar procurement',
          assignee: 'David Kim',
          assigneeEmail: 'david@acme-ops.io',
          dueDate: '2026-11-21',
          priority: 'High',
          confidenceScore: 0.91,
          verifiedByUser: true,
          emailSubject: 'Northstar Renewal: SLA Addendum & Order Form (Due Nov 21)',
          emailBody:
            'Hi David,\n\nReminder to send the updated SLA credit addendum and revised 24-month renewal order form to Northstar procurement by November 21.\n\nBest,\nCadence Ops\n\n[AI-Assisted Draft • Verified by User]',
        },
      ],
    },
  },
];
