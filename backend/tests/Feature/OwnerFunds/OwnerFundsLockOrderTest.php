<?php

declare(strict_types=1);

use App\Modules\OwnerFunds\Actions\CancelPayoutBatch;
use App\Modules\OwnerFunds\Actions\CloseAccountingMonth;
use App\Modules\OwnerFunds\Actions\ConfirmTrustDeposit;
use App\Modules\OwnerFunds\Actions\RequestTrustDeposit;
use App\Modules\OwnerFunds\Actions\ValidatePayoutItem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesQueryTrace as Q;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

/*
 * Ordre fixe des verrous (ADR 0026, 0031 décision 7 bis) : verrou du compte mandant, puis lignes `invoices`, puis
 * verrous de période. La preuve réelle exige MySQL à deux connexions ; ici, l'ordre des requêtes.
 */
function position(array $ordre, string $table, bool $verrouillee = false): int|false
{
    foreach ($ordre as $i => [$genre, $sql]) {
        if (str_contains($sql, $table) && (! $verrouillee || $genre === Q::LOCKED_READ)) {
            return $i;
        }
    }

    return false;
}

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $this->today = CarbonImmutable::parse('2026-12-10');
});

it('validation d\'un mandant : verrou du compte, puis factures, puis périodes', function (): void {
    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated();
    $item = $lot->json('data.items.0.id');

    $ordre = Q::run(fn () => L::dans($this->org, fn () => app(ValidatePayoutItem::class)->handle($item, null, $this->today)));
    $compte = position($ordre, 'ledger_party_locks');
    $factures = position($ordre, '"invoices"', true);
    $periodes = position($ordre, 'accounting_period_locks');

    expect($compte)->not->toBeFalse()->and($factures)->not->toBeFalse()->and($periodes)->not->toBeFalse()
        ->and($compte)->toBeLessThan($factures)
        ->and($factures)->toBeLessThan($periodes);
});

it('validation d\'un mandant : verrou du compte, puis verrou du lot, puis verrou de la ligne', function (): void {
    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated();
    $item = $lot->json('data.items.0.id');

    $ordre = Q::run(fn () => L::dans($this->org, fn () => app(ValidatePayoutItem::class)->handle($item, null, $this->today)));
    $compte = position($ordre, 'ledger_party_locks');
    $lotVerrouille = position($ordre, 'from "payout_batches"', true);
    $ligne = position($ordre, 'from "payout_items"', true);

    expect($compte)->not->toBeFalse()->and($lotVerrouille)->not->toBeFalse()->and($ligne)->not->toBeFalse()
        ->and($compte)->toBeLessThan($lotVerrouille)
        ->and($lotVerrouille)->toBeLessThan($ligne);
});

it('prélèvement et clôture : le verrou de l\'organisation précède les lectures du grand livre', function (): void {
    $this->actingAs(L::titulaire($this->org));
    $demande = L::dans($this->org, fn () => app(RequestTrustDeposit::class)->handle(100, '2026-12-10', 'APP-VERROU', 'verrou-demande-1', (string) Str::uuid(), $this->today))['deposit'];
    $apport = Q::run(fn () => L::dans($this->org, fn () => app(ConfirmTrustDeposit::class)->handle($demande->id, 'verrou-apport-1', (string) Str::uuid())));
    $cloture = Q::run(fn () => L::dans($this->org, fn () => app(CloseAccountingMonth::class)->handle(CarbonImmutable::parse('2026-12-01'), 'verrou-cloture-1', null, CarbonImmutable::parse('2027-01-05'))));

    foreach ([$apport, $cloture] as $ordre) {
        $compte = position($ordre, 'ledger_party_locks');
        $ecritures = position($ordre, 'journal_entries');

        expect($compte)->not->toBeFalse()->and($compte)->toBeLessThan($ecritures);
    }
});

it('annulation d\'un lot validé : le verrou du compte mandant précède la contrepassation', function (): void {
    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated()->json('data.id');
    $version = F::valider($this, $lot)->assertOk()->json('data.lock_version');

    $ordre = Q::run(fn () => L::dans($this->org, fn () => app(CancelPayoutBatch::class)->handle($lot, 'Erreur', $version, 'verrou-annulation-1', $this->today)));
    $compte = position($ordre, 'ledger_party_locks');
    $ecriture = position($ordre, 'insert into "journal_entries"');

    expect($compte)->not->toBeFalse()->and($ecriture)->not->toBeFalse()->and($compte)->toBeLessThan($ecriture);
});
