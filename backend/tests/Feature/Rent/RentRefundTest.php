<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Rent\Support\IssuerIdentity;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Rent\RentContext as C;

function soldeNet(object $org, AccountRole $role): int
{
    return (int) L::dans($org, fn () => DB::table('journal_lines')->join('accounts', 'accounts.id', '=', 'journal_lines.account_id')
        ->where('accounts.role', $role->value)->selectRaw('COALESCE(SUM(journal_lines.debit - journal_lines.credit), 0) as s')->value('s'));
}

function nouvelleSession(object $test): void
{
    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);
    app()->forgetInstance(IssuerIdentity::class);
}

function rembourser(object $test, object $org, string $bail, array $corps, string|false|null $cle = null): TestResponse
{
    return $test->postJson(C::url($org, "/leases/{$bail}/refunds"), $corps, $cle === false ? [] : ['Idempotency-Key' => $cle ?? 'remb-'.bin2hex(random_bytes(6))]);
}

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    ['bail' => $this->bail, 'lot' => $this->lot] = C::bail($this->org);
    C::emises($this->org, $this->bail, $this, '2026-11-25');
    C::payer($this, $this->org, $this->bail, 160000)->assertCreated()->assertJsonPath('data.advance.amount', 20000);
    $this->actingAs(L::titulaire($this->org));
});

it('rend une partie de l\'avance depuis la banque : débit du compte locataire, crédit de la banque, avance réduite, journal', function (): void {
    $avant = soldeNet($this->org, AccountRole::Bank);

    $reponse = rembourser($this, $this->org, $this->bail->id, ['amount' => 15000, 'reference' => 'VIR-12'])->assertCreated()
        ->assertJsonPath('data.amount.amount', 15000)->assertJsonPath('data.source', 'bank')->assertJsonPath('data.slices', 1)->assertJsonPath('data.replayed', false);

    expect(soldeNet($this->org, AccountRole::Bank) - $avant)->toBe(-15000)->and(C::du($this->org, $this->bail))->toBe(-5000)
        ->and(DB::table('audit_logs')->where('action', 'rent.refund.recorded')->where('subject_id', $reponse->json('data.id'))->count())->toBe(1);
    $this->getJson(C::url($this->org, "/leases/{$this->bail->id}/balance"))->assertOk()->assertJsonPath('data.advance.amount', 5000);
});

it('prend la banque de cantonnement quand le bail est routé vers un mandant', function (): void {
    nouvelleSession($this);
    $org = C::organisation(OrganizationKind::Agency, 'Agence du Quai');
    ['bail' => $bail, 'lot' => $lot] = C::bail($org);
    M::actif($org, $lot, L::dans($org, fn () => M::partie($org)));
    L::dans($org, fn () => app(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-01-01')));
    $this->travelTo('2026-11-16');
    C::emises($org, $bail, $this, '2026-11-25');
    C::payer($this, $org, $bail, 160000)->assertCreated();
    nouvelleSession($this);
    $this->actingAs(L::titulaire($org));

    rembourser($this, $org, $bail->id, ['amount' => 20000])->assertCreated()->assertJsonPath('data.source', 'trust');

    expect(soldeNet($org, AccountRole::TrustBank))->toBe(140000);
});

it('reprend l\'avance la plus ancienne d\'abord, sur plusieurs encaissements', function (): void {
    C::payer($this, $this->org, $this->bail, 30000)->assertCreated();

    rembourser($this, $this->org, $this->bail->id, ['amount' => 25000])->assertCreated()->assertJsonPath('data.slices', 2);

    expect(DB::table('rent_advance_refunds')->orderBy('id')->pluck('amount')->map(fn ($m): int => (int) $m)->all())->toBe([20000, 5000]);
});

it('refuse de rendre plus que l\'avance sans rien écrire', function (): void {
    $ecritures = DB::table('journal_entries')->count();

    rembourser($this, $this->org, $this->bail->id, ['amount' => 20001])->assertStatus(409)->assertJsonPath('code', 'rent_advance_insufficient');

    expect(DB::table('journal_entries')->count())->toBe($ecritures)->and(DB::table('rent_advance_refunds')->count())->toBe(0);
});

it('rejoue la même clé sans second remboursement ; refuse la même clé avec un autre montant', function (): void {
    rembourser($this, $this->org, $this->bail->id, ['amount' => 8000], 'remboursement-0001')->assertCreated();
    rembourser($this, $this->org, $this->bail->id, ['amount' => 8000], 'remboursement-0001')->assertOk()->assertJsonPath('data.replayed', true);
    rembourser($this, $this->org, $this->bail->id, ['amount' => 9000], 'remboursement-0001')->assertStatus(409);

    expect(DB::table('rent_advance_refunds')->count())->toBe(1)->and(C::du($this->org, $this->bail))->toBe(-12000);
});

it('exige l\'en-tête Idempotency-Key, un montant positif et une date qui n\'est pas future', function (): void {
    rembourser($this, $this->org, $this->bail->id, ['amount' => 1000], false)->assertStatus(422)->assertJsonPath('code', 'rent_idempotency_key_required');
    rembourser($this, $this->org, $this->bail->id, ['amount' => 0])->assertStatus(422);
    rembourser($this, $this->org, $this->bail->id, ['amount' => 1000, 'refunded_on' => '2026-12-31'])->assertStatus(422);
    rembourser($this, $this->org, $this->bail->id, [])->assertStatus(422);

    expect(DB::table('rent_advance_refunds')->count())->toBe(0);
});

it('ignore une devise ou une source de fonds envoyée par le client', function (): void {
    rembourser($this, $this->org, $this->bail->id, ['amount' => 1000, 'currency' => 'XOF', 'source' => 'trust', 'party_id' => (string) Str::uuid7()])->assertCreated()
        ->assertJsonPath('data.amount.currency', 'EUR')->assertJsonPath('data.source', 'bank');
});

it('exige une session, un rôle propriétaire, administrateur ou comptable avec deuxième facteur', function (): void {
    $url = "/leases/{$this->bail->id}/refunds";
    auth()->forgetGuards();
    $this->postJson(C::url($this->org, $url), ['amount' => 1000], ['Idempotency-Key' => 'remb-anonyme'])->assertUnauthorized();

    $gestionnaire = L::membre($this->org, MemberRole::Manager);
    activerDeuxFacteurs($gestionnaire);
    $sansFacteur = L::membre($this->org, MemberRole::Accountant);
    $etranger = User::factory()->create();

    foreach ([$gestionnaire, $sansFacteur] as $compte) {
        nouvelleSession($this);
        $this->actingAs($compte)->postJson(C::url($this->org, $url), ['amount' => 1000], ['Idempotency-Key' => 'remb-interdit'])->assertForbidden();
    }

    nouvelleSession($this);
    $this->actingAs($etranger)->postJson(C::url($this->org, $url), ['amount' => 1000], ['Idempotency-Key' => 'remb-etranger'])->assertNotFound();

    $comptable = L::membre($this->org, MemberRole::Accountant);
    activerDeuxFacteurs($comptable);
    nouvelleSession($this);
    $this->actingAs($comptable)->postJson(C::url($this->org, $url), ['amount' => 1000], ['Idempotency-Key' => 'remb-comptable'])->assertCreated();

    expect(DB::table('rent_advance_refunds')->count())->toBe(1);
});

it('répond 404 sur le bail d\'une autre organisation ou inconnu, sans rien écrire', function (): void {
    nouvelleSession($this);
    $autre = C::organisation(OrganizationKind::Agency, 'Agence Etrangere');
    ['bail' => $etranger] = C::bail($autre);
    nouvelleSession($this);
    $this->actingAs(L::titulaire($this->org));

    foreach ([$etranger->id, (string) Str::uuid7()] as $bail) {
        rembourser($this, $this->org, $bail, ['amount' => 1000])->assertNotFound();
    }

    expect(DB::table('rent_advance_refunds')->count())->toBe(0);
});
