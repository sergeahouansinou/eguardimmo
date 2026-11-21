<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\InboxTab;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Fils avec une contrepartie, vus de l'organisation courante par un membre habilité (rôles `owner`, `admin`, `manager`).
 */
final class StaffThreads
{
    public const array AUTRES_COTES = [MessageSide::Tenant, MessageSide::Owner];

    /**
     * @return Builder<Conversation>
     */
    public function list(string $userId, ConversationKind $kind): Builder
    {
        return ThreadScopes::withReadState(Conversation::query()->where('conversations.kind', $kind->value), $userId, self::AUTRES_COTES);
    }

    /**
     * Un fil avec une contrepartie de l'organisation courante, avec l'état de lecture du compte ; les fils internes n'en font pas partie.
     */
    public function find(string $userId, string $id): ?Conversation
    {
        return Str::isUuid($id)
            ? ThreadScopes::withReadState(Conversation::query()->where('conversations.kind', '!=', ConversationKind::Internal->value), $userId, self::AUTRES_COTES)->whereKey($id)->first()
            : null;
    }

    /**
     * @return array<string, int> nombre de fils par onglet
     */
    public function counts(string $userId, ConversationKind $kind, ?string $recherche): array
    {
        $compter = fn (InboxTab $onglet): int => $this->recherche(ThreadScopes::tab(Conversation::query()->where('conversations.kind', $kind->value), $onglet, $userId), $recherche)->count();

        return array_combine(
            array_map(fn (InboxTab $onglet): string => $onglet->value, InboxTab::cases()),
            array_map($compter, InboxTab::cases()),
        );
    }

    /**
     * @return array<string, int> fils non lus par type
     */
    public function unread(string $userId, bool $tenant, bool $owner): array
    {
        $compter = fn (ConversationKind $kind): int => ThreadScopes::unread(ThreadScopes::archived(Conversation::query()->where('conversations.kind', $kind->value), $userId, false), $userId)->count();

        return [
            ConversationKind::Tenant->value => $tenant ? $compter(ConversationKind::Tenant) : 0,
            ConversationKind::Owner->value => $owner ? $compter(ConversationKind::Owner) : 0,
        ];
    }

    /**
     * @param  Builder<Conversation>  $requete
     * @return Builder<Conversation>
     */
    public function recherche(Builder $requete, ?string $recherche): Builder
    {
        if ($recherche === null) {
            return $requete;
        }

        return $requete->where('conversations.subject', 'like', '%'.addcslashes($recherche, '%_\\').'%');
    }
}
