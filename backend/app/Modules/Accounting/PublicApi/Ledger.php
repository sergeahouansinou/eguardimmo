<?php

declare(strict_types=1);

namespace App\Modules\Accounting\PublicApi;

use App\Modules\Accounting\Actions\PostJournalEntry;
use App\Modules\Accounting\Actions\ReverseJournalEntry;
use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\PostedEntryData;
use Carbon\CarbonImmutable;

/**
 * Écriture du grand livre : à appeler dans la transaction de l'appelant, sous le contexte d'organisation (ADR 0007).
 */
final readonly class Ledger
{
    public function __construct(
        private PostJournalEntry $ecriture,
        private ReverseJournalEntry $contrePassation,
    ) {}

    /**
     * Rejouer la même clé d'idempotence avec le même contenu renvoie l'écriture existante (`replayed`) ; un contenu différent est refusé.
     */
    public function post(EntryData $entry): PostedEntryData
    {
        return $this->ecriture->handle($entry);
    }

    public function reverse(string $entryId, CarbonImmutable $date): PostedEntryData
    {
        return $this->contrePassation->handle($entryId, $date);
    }
}
