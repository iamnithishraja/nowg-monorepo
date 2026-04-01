import { connectToDatabase } from "./packages/web/app/lib/mongo";
import { getSupportTicketModel } from "./packages/shared/src/models/supportTicketModel";

async function run() {
  await connectToDatabase();
  const SupportTicket = getSupportTicketModel();
  const tickets = await SupportTicket.find().lean();
  console.log("ALL TICKETS:", tickets.map(t => ({ _id: t._id, userId: t.userId, subject: t.subject, status: t.status })));
  process.exit(0);
}

run().catch(console.error);
