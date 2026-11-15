<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Data\NewTicketData;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\TicketPriority;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Support\ReferenceSequence;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use Illuminate\Support\Facades\DB;

final readonly class OpenSupportTicket
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private PostSupportMessage $poster,
    ) {}

    public function handle(User $demandeur, NewTicketData $donnees): SupportTicket
    {
        $adhesion = $donnees->organizationId === null ? null : $this->adhesions->activeMembership($demandeur->id, $donnees->organizationId);

        if ($donnees->organizationId !== null && $adhesion === null) {
            throw ErrorCode::NotAMember->problem();
        }

        return DB::transaction(function () use ($demandeur, $donnees, $adhesion): SupportTicket {
            $ticket = SupportTicket::query()->create([
                'reference' => ReferenceSequence::next(),
                'requester_user_id' => $demandeur->id,
                'organization_id' => $adhesion?->organizationId,
                'organization_name' => $adhesion?->organizationName,
                'space' => $donnees->space,
                'category' => $donnees->category,
                'subject' => $donnees->subject,
                'priority' => TicketPriority::Normal,
                'status' => TicketStatus::Open,
                'last_activity_at' => now(),
            ]);

            $this->poster->handle($ticket, $demandeur, fromSupport: false, internal: false, body: $donnees->body, attachments: $donnees->attachments);

            return $ticket;
        });
    }
}
