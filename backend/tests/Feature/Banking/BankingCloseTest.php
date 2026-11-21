<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;

it('refuse la clôture du mois par l\'API comptable tant que le rapprochement manque', function (): void {
    ['org' => $org, 'bail' => $bail] = F::agence($this);
    B::reauthentifier($this);
    $compte = B::compte($this, $org, 'trust_bank');
    C::emises($org, $bail, $this);
    B::reauthentifier($this);
    C::payer($this, $org, $bail, 70000)->assertCreated();
    $this->travelTo(CarbonImmutable::parse('2026-12-10 10:00:00'));
    B::reauthentifier($this);

    F::envoyer($this, 'POST', "/api/v1/org/{$org->id}/accounting/periods/close", ['month' => '2026-11'])->assertStatus(409)->assertJsonPath('code', 'accounting_period_not_closable');

    B::importer($this, $org, $compte, B::camt([['2026-11-16', 'CRDT', '700.00', 'VIR LOYER']], ouverture: 0, cloture: 70000), 'camt053', nom: 'r.xml')->assertCreated();
    $ligne = B::lignes($this, $org)['VIR LOYER'];
    B::envoyer($this, 'POST', B::url($org, "/lines/{$ligne['id']}/match"), ['journal_line_ids' => B::ecritures($this, $org, $compte), 'lock_version' => $ligne['lock_version']])->assertCreated();
    $etat = B::envoyer($this, 'POST', B::url($org, '/reconciliations'), ['bank_account_id' => $compte, 'month' => '2026-11'])->assertCreated()->json('data.id');
    B::envoyer($this, 'POST', B::url($org, "/reconciliations/{$etat}/validate"))->assertOk();

    F::envoyer($this, 'POST', "/api/v1/org/{$org->id}/accounting/periods/close", ['month' => '2026-11'])->assertSuccessful();
});

function bkAgenceAvecLoyerDeNovembre(object $test): array
{
    ['org' => $org, 'bail' => $bail] = F::agence($test);
    B::reauthentifier($test);
    $compte = B::compte($test, $org, 'trust_bank');
    C::emises($org, $bail, $test);
    B::reauthentifier($test);
    C::payer($test, $org, $bail, 70000)->assertCreated();
    $test->travelTo(CarbonImmutable::parse('2026-12-10 10:00:00'));
    B::reauthentifier($test);

    return [$org, $compte];
}

it('garde le blocage de la clôture quand le compte de tiers est fermé ou remplacé, jusqu\'à l\'état validé de l\'ancien compte', function (): void {
    [$org, $compte] = bkAgenceAvecLoyerDeNovembre($this);
    B::importer($this, $org, $compte, B::camt([['2026-11-16', 'CRDT', '700.00', 'VIR LOYER']], ouverture: 0, cloture: 70000), 'camt053', nom: 'r.xml')->assertCreated();
    $ligne = B::lignes($this, $org)['VIR LOYER'];
    B::envoyer($this, 'POST', B::url($org, "/lines/{$ligne['id']}/match"), ['journal_line_ids' => B::ecritures($this, $org, $compte), 'lock_version' => $ligne['lock_version']])->assertCreated();

    $nouveau = B::envoyer($this, 'POST', B::url($org, "/accounts/{$compte}/replace"), [
        'label' => 'Nouveau compte', 'bank_name' => 'Banque 2', 'holder_name' => 'Agence du Port', 'identifier_kind' => 'iban', 'identifier' => B::AUTRE_IBAN,
        'reconciliation_from' => '2026-12-01', 'opening_bank_balance' => 70000, 'csv_profile' => B::profil(),
    ])->assertCreated();

    expect($nouveau->json('data.replaces_id'))->toBe($compte);
    F::envoyer($this, 'POST', "/api/v1/org/{$org->id}/accounting/periods/close", ['month' => '2026-11'])->assertStatus(409)->assertJsonPath('code', 'accounting_period_not_closable');

    $etat = B::envoyer($this, 'POST', B::url($org, '/reconciliations'), ['bank_account_id' => $compte, 'month' => '2026-11'])->assertCreated()->json('data.id');
    B::envoyer($this, 'POST', B::url($org, "/reconciliations/{$etat}/validate"))->assertOk();

    F::envoyer($this, 'POST', "/api/v1/org/{$org->id}/accounting/periods/close", ['month' => '2026-11'])->assertSuccessful();
});

it('refuse un début de suivi dans le futur, avant le compte remplacé ou après la fin du mois de sa fermeture', function (): void {
    [$org, $compte] = bkAgenceAvecLoyerDeNovembre($this);
    $remplacer = fn (string $debut) => B::envoyer($this, 'POST', B::url($org, "/accounts/{$compte}/replace"), [
        'label' => 'Nouveau compte', 'bank_name' => 'Banque 2', 'holder_name' => 'Agence du Port', 'identifier_kind' => 'iban', 'identifier' => B::AUTRE_IBAN,
        'reconciliation_from' => $debut, 'opening_bank_balance' => 0, 'csv_profile' => B::profil(),
    ]);

    $remplacer('2026-12-11')->assertStatus(422)->assertJsonPath('code', 'bank_account_start_invalid');
    $remplacer('2025-12-31')->assertStatus(422)->assertJsonPath('code', 'bank_account_start_invalid');
    expect(DB::table('organization_bank_accounts')->where('status', 'active')->count())->toBe(1);

    B::envoyer($this, 'POST', B::url($org, "/accounts/{$compte}/close"))->assertOk();
    $creer = fn (string $debut) => B::envoyer($this, 'POST', B::url($org, '/accounts'), [
        'ledger_role' => 'trust_bank', 'label' => 'Compte 2', 'bank_name' => 'Banque 2', 'holder_name' => 'Agence du Port', 'identifier_kind' => 'iban',
        'identifier' => B::AUTRE_IBAN, 'reconciliation_from' => $debut, 'opening_bank_balance' => 0, 'csv_profile' => B::profil(),
    ]);

    $creer('2026-12-31')->assertStatus(422)->assertJsonPath('code', 'bank_account_start_invalid');
    $creer('2025-12-31')->assertStatus(422)->assertJsonPath('code', 'bank_account_start_invalid');

    $this->travelTo(CarbonImmutable::parse('2027-03-01 10:00:00'));
    B::reauthentifier($this);
    $creer('2027-02-01')->assertStatus(422)->assertJsonPath('code', 'bank_account_start_invalid');
    $creer('2026-12-01')->assertCreated();
});

it('exige un compte de tiers suivi pour clore le mois d\'une agence qui détient des fonds de tiers', function (): void {
    config(['banking.require_trust_account' => true]);
    ['org' => $org, 'bail' => $bail] = F::agence($this);
    B::reauthentifier($this);
    C::emises($org, $bail, $this);
    B::reauthentifier($this);
    C::payer($this, $org, $bail, 70000)->assertCreated();
    $this->travelTo(CarbonImmutable::parse('2026-12-10 10:00:00'));
    B::reauthentifier($this);

    F::envoyer($this, 'POST', "/api/v1/org/{$org->id}/accounting/periods/close", ['month' => '2026-11'])->assertStatus(409)->assertJsonPath('code', 'accounting_period_not_closable');

    config(['banking.require_trust_account' => false]);

    F::envoyer($this, 'POST', "/api/v1/org/{$org->id}/accounting/periods/close", ['month' => '2026-11'])->assertSuccessful();
});
