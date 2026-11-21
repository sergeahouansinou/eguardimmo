<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\PublicApi\OperatorDirectory;
use App\Modules\Messaging\Data\TicketPatchData;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportTicket;
use Illuminate\Support\Facades\DB;

final readonly class UpdateSupportTicket
{
    public function __construct(
        private OperatorDirectory $operateurs,
        private MarkSupportTicketRead $lecture,
        private ExpireSupportAccess $acces,
    ) {}

    public function handle(SupportTicket $ticket, TicketPatchData $modifications): SupportTicket
    {
        if ($modifications->assigneeUserId !== null && ! $this->operateurs->isActive($modifications->assigneeUserId)) {
            throw ErrorCode::NotAnOperator->problem();
        }

        $change = $modifications->status !== null || $modifications->priority !== null || $modifications->assigneeProvided;

        return DB::transaction(function () use ($ticket, $modifications, $change): SupportTicket {
            $ticket = SupportTicket::query()->whereKey($ticket->id)->lockForUpdate()->firstOrFail();

            if ($modifications->status !== null) {
                $resolue = $modifications->status === TicketStatus::Resolved;
                $ticket->resolved_at = $resolue ? ($ticket->status === TicketStatus::Resolved ? $ticket->resolved_at : now()) : null;
                $ticket->moveTo($modifications->status);
            }

            if ($modifications->priority !== null) {
                $ticket->priority = $modifications->priority;
            }

            if ($modifications->assigneeProvided) {
                $ticket->assignee_user_id = $modifications->assigneeUserId;
            }

            if ($change) {
                $ticket->last_activity_at = now();
                $ticket->save();
            }

            if ($ticket->status === TicketStatus::Resolved) {
                $this->acces->handle($ticket->id);
            }

            if ($modifications->read) {
                $this->lecture->handle($ticket, parLeSupport: true);
            }

            return $ticket;
        });
    }
}
