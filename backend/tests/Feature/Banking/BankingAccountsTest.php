<?php

declare(strict_types=1);

use App\Modules\Banking\Models\OrganizationBankAccount;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    $this->org = B::agence($this);
});

function bkCorpsCompte(array $surcharges = []): array
{
    return ['ledger_role' => 'bank', 'label' => 'Courant', 'holder_name' => 'Agence', 'identifier_kind' => 'iban', 'identifier' => B::IBAN,
        'reconciliation_from' => B::DEBUT, 'opening_bank_balance' => 100000, ...$surcharges];
}

it('crée un compte sans jamais exposer ni stocker l\'IBAN', function (): void {
    $r = B::envoyer($this, 'POST', B::url($this->org, '/accounts'), bkCorpsCompte())->assertCreated();

    expect($r->json('data.last4'))->toBe('0189')->and($r->json('data.currency'))->toBe('EUR')->and($r->json('data.status'))->toBe('active')
        ->and(json_encode($r->json()))->not->toContain(B::IBAN)->not->toContain('identifier_hash');

    $ligne = (array) DB::table('organization_bank_accounts')->first();

    expect(json_encode($ligne))->not->toContain(B::IBAN)->and($ligne['identifier_hash'])->toMatch('/^[0-9a-f]{64}$/')->and($ligne['identifier_last4'])->toBe('0189');
    expect(DB::table('audit_logs')->get()->map(fn ($l) => json_encode($l))->implode(''))->not->toContain(B::IBAN)->not->toContain($ligne['identifier_hash']);
});

it('refuse un IBAN invalide et une devise étrangère', function (): void {
    B::envoyer($this, 'POST', B::url($this->org, '/accounts'), bkCorpsCompte(['identifier' => 'FR7630006000011234567890188']))->assertStatus(422)->assertJsonPath('code', 'bank_account_identifier_invalid');
    expect(DB::table('organization_bank_accounts')->count())->toBe(0);
});

it('un seul compte actif par rôle du grand livre, un autre rôle reste possible', function (): void {
    B::compte($this, $this->org);

    B::envoyer($this, 'POST', B::url($this->org, '/accounts'), bkCorpsCompte(['identifier' => B::AUTRE_IBAN]))->assertStatus(409)->assertJsonPath('code', 'bank_account_role_taken');
    B::envoyer($this, 'POST', B::url($this->org, '/accounts'), bkCorpsCompte(['identifier' => B::AUTRE_IBAN, 'ledger_role' => 'trust_bank']))->assertCreated();
});

it('exige une Idempotency-Key et rejoue sans doublon', function (): void {
    $this->postJson(B::url($this->org, '/accounts'), bkCorpsCompte())->assertStatus(422)->assertJsonPath('code', 'banking_idempotency_key_required');

    $a = B::envoyer($this, 'POST', B::url($this->org, '/accounts'), bkCorpsCompte(), 'cle-compte');
    $b = B::envoyer($this, 'POST', B::url($this->org, '/accounts'), bkCorpsCompte(), 'cle-compte');

    expect($a->status())->toBe(201)->and($b->json('data.id'))->toBe($a->json('data.id'));
    expect(DB::table('organization_bank_accounts')->count())->toBe(1);
    B::envoyer($this, 'POST', B::url($this->org, '/accounts'), bkCorpsCompte(['label' => 'Autre']), 'cle-compte')->assertStatus(409)->assertJsonPath('code', 'banking_idempotency_key_reused');
});

it('remplace un compte : l\'ancien est fermé, le nouveau actif et chaîné', function (): void {
    $ancien = B::compte($this, $this->org);

    $r = B::envoyer($this, 'POST', B::url($this->org, "/accounts/{$ancien}/replace"), bkCorpsCompte(['identifier' => B::AUTRE_IBAN, 'ledger_role' => null]))->assertCreated();

    expect($r->json('data.replaces_id'))->toBe($ancien)->and($r->json('data.status'))->toBe('active');
    expect(B::compteModele($this->org, $ancien)->status->value)->toBe('closed');
});

it('modifie le libellé et ferme un compte, puis refuse d\'importer dessus', function (): void {
    $compte = B::compte($this, $this->org);

    B::envoyer($this, 'PATCH', B::url($this->org, "/accounts/{$compte}"), ['label' => 'Compte principal'])->assertOk()->assertJsonPath('data.label', 'Compte principal');
    B::envoyer($this, 'POST', B::url($this->org, "/accounts/{$compte}/close"))->assertOk()->assertJsonPath('data.status', 'closed');
    B::importer($this, $this->org, $compte, B::csv([['02/11/2026', 'X', '1,00']]))->assertStatus(409)->assertJsonPath('code', 'bank_account_closed');
});

it('liste et affiche les comptes de l\'organisation seulement', function (): void {
    $compte = B::compte($this, $this->org);

    $this->getJson(B::url($this->org, '/accounts'))->assertOk()->assertJsonCount(1, 'data');
    $this->getJson(B::url($this->org, "/accounts/{$compte}"))->assertOk()->assertJsonPath('data.id', $compte);
});

it('journalise la création sans donnée bancaire', function (): void {
    B::compte($this, $this->org);

    $actions = DB::table('audit_logs')->pluck('action')->all();

    expect($actions)->toContain('banking.account.created');
});

it('autorise le même IBAN dans deux organisations', function (): void {
    B::compte($this, $this->org);
    $autre = C::organisation(nom: 'Autre agence');
    MandatesSecurityContext::changer();
    $this->actingAs(L::titulaire($autre));
    B::reauthentifier($this);

    expect(B::compte($this, $autre))->not->toBeEmpty();
    expect(L::dans($autre, fn () => OrganizationBankAccount::query()->count()))->toBe(1);
});
