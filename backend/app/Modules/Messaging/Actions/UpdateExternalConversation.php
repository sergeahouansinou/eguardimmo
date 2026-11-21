<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ConversationStatus;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Organizations\Data\TeamMemberData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Fermeture, réouverture et assignation d'un fil par l'équipe de gestion. Idempotent : rejouer l'état déjà posé ne journalise rien.
 */
final readonly class UpdateExternalConversation
{
    public function __construct(
        private MembershipDirectory $annuaire,
        private RecordAudit $audit,
    ) {}

    public function handle(Conversation $fil, User $acteur, ?ConversationStatus $statut, bool $assigner, ?string $assigneId): Conversation
    {
        return DB::transaction(function () use ($fil, $acteur, $statut, $assigner, $assigneId): Conversation {
            $conversation = Conversation::query()->whereKey($fil->id)->lockForUpdate()->firstOrFail();

            if ($statut !== null && $statut !== $conversation->status) {
                $conversation->forceFill([
                    'status' => $statut,
                    'closed_at' => $statut === ConversationStatus::Closed ? now() : null,
                    'closed_by_user_id' => $statut === ConversationStatus::Closed ? $acteur->id : null,
                ])->save();
                $this->audit->handle($statut === ConversationStatus::Closed ? 'messaging.conversation.closed' : 'messaging.conversation.reopened', subject: $conversation, metadata: ['kind' => $conversation->kind->value]);
            }

            if ($assigner && $assigneId !== $conversation->assignee_user_id) {
                $this->verifierAssigne($assigneId);
                $conversation->forceFill(['assignee_user_id' => $assigneId])->save();
                $this->audit->handle('messaging.conversation.assigned', subject: $conversation, metadata: ['kind' => $conversation->kind->value, 'assigned' => $assigneId !== null]);
            }

            return $conversation;
        });
    }

    private function verifierAssigne(?string $assigneId): void
    {
        if ($assigneId === null) {
            return;
        }

        $gestionnaires = array_filter(
            $this->annuaire->activeTeam(),
            fn (TeamMemberData $m): bool => in_array($m->role, [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager], true),
        );

        if (! in_array($assigneId, array_map(fn (TeamMemberData $m): string => $m->userId, $gestionnaires), true)) {
            throw ErrorCode::AssigneeInvalid->problem();
        }
    }
}
