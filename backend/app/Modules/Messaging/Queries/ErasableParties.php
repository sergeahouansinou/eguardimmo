<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Messaging\Actions\ErasePartyMessages;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Shared\Tenancy\AcrossOrganizations;

final class ErasableParties
{
    /**
     * Fiches qui portent encore un texte de la contrepartie ou un motif de restriction, par organisation : le rattrapage demande ensuite
     * à Parties lesquelles sont anonymisées.
     *
     * @return array<string, list<string>>
     */
    public function byOrganization(): array
    {
        $avecTexte = AcrossOrganizations::query(ConversationMessage::class)
            ->where('author_side', '!=', 'staff')
            ->where('body', '!=', ErasePartyMessages::TEXTE)
            ->select('conversation_id');

        $fiches = AcrossOrganizations::query(Conversation::class)
            ->whereNotNull('party_id')
            ->where(fn ($q) => $q->whereIn('id', $avecTexte)->orWhereNotNull('counterpart_muted_reason'))
            ->select('organization_id', 'party_id')
            ->distinct()
            ->orderBy('organization_id')
            ->orderBy('party_id')
            ->get();

        $parOrganisation = [];

        foreach ($fiches as $fiche) {
            $parOrganisation[(string) $fiche->organization_id][] = (string) $fiche->party_id;
        }

        return $parOrganisation;
    }
}
