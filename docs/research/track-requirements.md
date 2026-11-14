# Track requirements and source notes

Checked: 2026-11-14. Separate public rules from the team's proposed strategy.

## Public event information

The [Fall 2026 event listing](https://hackprinceton-fall-26.devpost.com/)
lists Business & Enterprise and MLH prizes for both Tiger Data and MongoDB Atlas.
It requests a public GitHub repository created during Nov 13–15, a presentation
of at most two minutes, and an optional video of at most two minutes. Its listed
deadline is Nov 15 at 8:30 a.m. EST. Confirm updates with organizers.

Tiger's description emphasizes substantive use for real-time data and analytics;
Atlas asks for a hack using Atlas. No database integration exists in this repo yet.
The listing also states category winners are ineligible for Best Overall; confirm
how that interacts with sponsor awards rather than assuming unrestricted stacking.

## Team-provided sponsor descriptions

The team named CoStar's “Inside and Out: AI for the Built World,” Amazon's “Best
Practical AI Innovation,” Peri's “Forward Deploy Challenge,” and LangChain's best
use of Deep Agents. The [event website](https://www.hackprinceton.com/) lists these
organizations as sponsors, but the public pages checked did not establish those
prizes' detailed requirements. Treat the team's descriptions as planning input.

Ask mentors or organizers for the exact rubric, submission opt-ins, required SDKs
or cloud services, interview evidence rules, and multi-prize eligibility. Record a
source/date when confirmed. No claim that AWS, LangSmith, CoStar data, or a specific
model provider is required is supported by this research.

## Technical primary sources

- [Deep Agents overview](https://docs.langchain.com/oss/javascript/deepagents/overview)
  and [TypeScript quickstart](https://docs.langchain.com/oss/javascript/deepagents/quickstart).
- [Specialist subagents](https://docs.langchain.com/oss/javascript/deepagents/subagents),
  [human review](https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop),
  and [MCP adapters](https://docs.langchain.com/oss/javascript/langchain/mcp).
- [Tiger hypertables](https://www.tigerdata.com/docs/learn/hypertables/understand-hypertables),
  [unique constraints](https://www.tigerdata.com/docs/build/performance-optimization/hypertables-and-unique-indexes),
  and [continuous aggregates](https://www.tigerdata.com/docs/learn/continuous-aggregates).
- [MongoDB Atlas](https://www.mongodb.com/docs/atlas/) for the alternative considered.

Our integration, schema boundaries, demo, and priority choices are design
inferences from these capabilities, not sponsor endorsements or verified runtime
behavior. Recheck SDK and hosted-service details when pinning dependencies.
