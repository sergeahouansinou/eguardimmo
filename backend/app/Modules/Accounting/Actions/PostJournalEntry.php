<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Actions;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Data\PostedEntryData;
use App\Modules\Accounting\Enums\ErrorCode;
use App\Modules\Accounting\Enums\Side;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\ChartOfAccounts;
use App\Modules\Accounting\Support\EntryMapper;
use App\Modules\Accounting\Support\EntryNumbering;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Currencies\ISOCurrencies;
use Money\Money;

/**
 * Seul chemin d'écriture du grand livre : tout contrôle d'équilibre passe ici.
 */
final readonly class PostJournalEntry
{
    private const LIGNES_MAX = 200;

    public function __construct(
        private CurrentOrganization $contexte,
        private ChartOfAccounts $plan,
        private EntryNumbering $numerotation,
        private EntryMapper $mapper,
    ) {}

    public function handle(EntryData $donnees, ?string $reversalOfId = null): PostedEntryData
    {
        $this->valider($donnees);
        $empreinte = $this->empreinte($donnees);

        return DB::transaction(function () use ($donnees, $empreinte, $reversalOfId): PostedEntryData {
            $existante = $this->existante($donnees->idempotencyKey, false);

            if ($existante !== null) {
                return $this->rejouer($existante, $empreinte);
            }

            try {
                $entree = DB::transaction(fn (): JournalEntry => $this->ecrire($donnees, $empreinte, $reversalOfId));
            } catch (UniqueConstraintViolationException $erreur) {
                $existante = $this->existante($donnees->idempotencyKey, true) ?? throw $erreur;

                return $this->rejouer($existante, $empreinte);
            }

            return $this->mapper->map($entree, replayed: false);
        });
    }

    private function ecrire(EntryData $donnees, string $empreinte, ?string $reversalOfId): JournalEntry
    {
        $organisation = $this->contexte->id();
        $annee = (int) $donnees->date->format('Y');
        $roles = [];

        foreach ($donnees->lines as $ligne) {
            $roles[$ligne->account->value] = $ligne->account;
        }

        $comptes = $this->plan->idsFor(array_values($roles));

        $entree = JournalEntry::query()->create([
            'fiscal_year' => $annee,
            'number' => $this->numerotation->next($organisation, $annee),
            'journal' => $donnees->journal,
            'entry_date' => $donnees->date->format('Y-m-d'),
            'label' => trim($donnees->label),
            'source_type' => $donnees->sourceType,
            'source_id' => $donnees->sourceId,
            'idempotency_key' => $donnees->idempotencyKey,
            'fingerprint' => $empreinte,
            'reversal_of_id' => $reversalOfId,
        ]);

        foreach ($donnees->lines as $position => $ligne) {
            $devise = $ligne->amount->getCurrency();
            $zero = new Money(0, $devise);

            JournalLine::query()->create([
                'journal_entry_id' => $entree->id,
                'position' => $position + 1,
                'account_id' => $comptes[$ligne->account->value],
                'debit' => $ligne->side === Side::Debit ? $ligne->amount : $zero,
                'credit' => $ligne->side === Side::Credit ? $ligne->amount : $zero,
                'lease_id' => $ligne->leaseId,
                'party_id' => $ligne->partyId,
                'unit_id' => $ligne->unitId,
                'item_type' => $ligne->itemType,
                'item_id' => $ligne->itemId,
            ]);
        }

        return $entree->load('lines.account');
    }

    /**
     * Sous verrou, le snapshot de la transaction peut dater d'avant le commit du concurrent : lignes et comptes se relisent alors par lecture courante.
     */
    private function existante(string $cle, bool $verrou): ?JournalEntry
    {
        $entree = JournalEntry::query()
            ->where('idempotency_key', $cle)
            ->when($verrou, fn ($requete) => $requete->lockForUpdate())
            ->first();

        $entree?->load($verrou
            ? ['lines' => fn ($lignes) => $lignes->sharedLock(), 'lines.account' => fn ($comptes) => $comptes->sharedLock()]
            : ['lines.account']);

        return $entree;
    }

    private function rejouer(JournalEntry $existante, string $empreinte): PostedEntryData
    {
        if (! hash_equals($existante->fingerprint, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $this->mapper->map($existante, replayed: true);
    }

    private function valider(EntryData $donnees): void
    {
        $cle = $donnees->idempotencyKey;

        if (trim($donnees->label) === '' || mb_strlen($donnees->label) > 255) {
            throw ErrorCode::EntryInvalid->problem('Le libellé est obligatoire et limité à 255 caractères.');
        }

        if ($cle === '' || mb_strlen($cle) > 120) {
            throw ErrorCode::EntryInvalid->problem('La clé d\'idempotence est obligatoire et limitée à 120 caractères.');
        }

        if (! Str::isUuid($donnees->sourceId)) {
            throw ErrorCode::EntryInvalid->problem('La source de l\'écriture doit être identifiée par un UUID.');
        }

        if (count($donnees->lines) < 2 || count($donnees->lines) > self::LIGNES_MAX) {
            throw ErrorCode::EntryInvalid->problem('Une écriture compte entre 2 et '.self::LIGNES_MAX.' lignes.');
        }

        $devises = new ISOCurrencies;
        $totaux = [];

        foreach ($donnees->lines as $ligne) {
            $this->validerLigne($ligne, $devises);
            $code = $ligne->amount->getCurrency()->getCode();
            $totaux[$code][$ligne->side->value] = ($totaux[$code][$ligne->side->value] ?? new Money(0, $ligne->amount->getCurrency()))->add($ligne->amount);
        }

        foreach ($totaux as $parSens) {
            $debit = $parSens[Side::Debit->value] ?? null;
            $credit = $parSens[Side::Credit->value] ?? null;

            if ($debit === null || $credit === null || ! $debit->equals($credit)) {
                throw ErrorCode::EntryUnbalanced->problem();
            }
        }
    }

    private function validerLigne(LineData $ligne, ISOCurrencies $devises): void
    {
        if (! $ligne->amount->isPositive()) {
            throw ErrorCode::EntryInvalid->problem('Chaque ligne porte un montant strictement positif.');
        }

        if (! $devises->contains($ligne->amount->getCurrency())) {
            throw ErrorCode::EntryInvalid->problem('Devise inconnue (ISO 4217).');
        }

        if (($ligne->itemType === null) !== ($ligne->itemId === null)) {
            throw ErrorCode::EntryInvalid->problem('La créance référencée exige son type et son identifiant.');
        }

        foreach ([$ligne->leaseId, $ligne->partyId, $ligne->unitId, $ligne->itemId] as $reference) {
            if ($reference !== null && ! Str::isUuid($reference)) {
                throw ErrorCode::EntryInvalid->problem('Les références analytiques sont des UUID.');
            }
        }
    }

    private function empreinte(EntryData $donnees): string
    {
        return hash('sha256', (string) json_encode([
            $donnees->journal->value,
            $donnees->date->format('Y-m-d'),
            trim($donnees->label),
            $donnees->sourceType->value,
            $donnees->sourceId,
            array_map(fn (LineData $ligne): array => [
                $ligne->account->value, $ligne->side->value, $ligne->amount->getAmount(), $ligne->amount->getCurrency()->getCode(),
                $ligne->leaseId, $ligne->partyId, $ligne->unitId, $ligne->itemType?->value, $ligne->itemId,
            ], $donnees->lines),
        ], JSON_THROW_ON_ERROR));
    }
}
