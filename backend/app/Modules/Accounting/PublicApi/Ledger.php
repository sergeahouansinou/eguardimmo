<?php

declare(strict_types=1);

namespace App\Modules\Accounting\PublicApi;

use App\Modules\Accounting\Actions\CloseMonth;
use App\Modules\Accounting\Actions\PostJournalEntry;
use App\Modules\Accounting\Actions\ReverseJournalEntry;
use App\Modules\Accounting\Data\AccountingPeriodData;
use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\PostedEntryData;
use App\Modules\Accounting\Support\LedgerSettings;
use App\Modules\Accounting\Support\PartyLocks;
use Carbon\CarbonImmutable;
use Closure;

/**
 * Écriture du grand livre : à appeler dans la transaction de l'appelant, sous le contexte d'organisation (ADR 0007).
 */
final readonly class Ledger
{
    public function __construct(
        private PostJournalEntry $ecriture,
        private ReverseJournalEntry $contrePassation,
        private CloseMonth $cloture,
        private PartyLocks $verrous,
        private LedgerSettings $reglages,
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

    /**
     * Verrou du compte d'un mandant, après la ligne du bail et avant la facture : à prendre avant toute lecture de son solde qui décide d'un décaissement.
     */
    public function lockParty(string $partyId): void
    {
        $this->verrous->lock($partyId);
    }

    /**
     * Clôt le plus ancien mois ouvert ; `$blockers` renvoie les motifs de refus de l'appelant, lus sous le verrou des périodes.
     *
     * @param  Closure(): list<string>  $blockers
     */
    public function closeMonth(CarbonImmutable $month, ?string $userId, Closure $blockers, CarbonImmutable $today): AccountingPeriodData
    {
        return $this->cloture->handle($month, $userId, $blockers, $today);
    }

    /**
     * Active le routage des loyers vers les comptes de mandants ; sans effet si déjà actif.
     */
    public function activateOwnerFunds(CarbonImmutable $at): void
    {
        $this->reglages->activateOwnerFunds($at);
    }
}
