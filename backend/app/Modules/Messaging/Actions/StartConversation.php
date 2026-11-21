<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Data\NewConversationData;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Organizations\Data\TeamMemberData;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use Illuminate\Support\Facades\DB;

final readonly class StartConversation
{
    public function __construct(
        private MembershipDirectory $annuaire,
        private PostConversationMessage $poster,
    ) {}

    public function handle(User $auteur, NewConversationData $donnees): Conversation
    {
        $destinataires = array_map(fn (TeamMemberData $m): string => $m->userId, $this->annuaire->activeTeam());

        if ($donnees->recipientUserId === $auteur->id || ! in_array($donnees->recipientUserId, $destinataires, true)) {
            throw ErrorCode::RecipientNotFound->problem();
        }

        return DB::transaction(function () use ($auteur, $donnees): Conversation {
            $conversation = Conversation::query()->create([
                'subject' => $donnees->subject,
                'created_by_user_id' => $auteur->id,
                'last_message_at' => now(),
                'last_author_user_id' => $auteur->id,
            ]);

            $conversation->participants()->create(['user_id' => $auteur->id, 'last_read_at' => now()]);
            $conversation->participants()->create(['user_id' => $donnees->recipientUserId]);

            $this->poster->handle($conversation, $auteur, MessageSide::Staff, $donnees->body, $donnees->attachments, $donnees->clientId);

            return $conversation;
        });
    }
}
