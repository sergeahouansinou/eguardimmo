<?php

declare(strict_types=1);

require_once __DIR__.'/helpers.php';

use App\Modules\Accounting\Enums\ErrorCode;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Str;
use Money\Money;

beforeEach(function (): void {
    $this->org = comptaOrganisation();
    $this->bail = (string) Str::uuid7();
    $this->base = "/api/v1/org/{$this->org->id}/accounting";
    $this->ecriture = comptaPoster($this->org, comptaLoyer('api:1', Money::EUR(90000), '2026-11-01', ['lease' => $this->bail]));
    comptaPoster($this->org, comptaLoyer('api:2', Money::XOF(150000), '2026-11-02'));
    comptaPoster($this->org, comptaLoyer('api:3', Money::EUR(5000), '2026-11-03'));
});

it('exige une session : 401', function (string $chemin): void {
    $this->getJson($this->base.$chemin)->assertUnauthorized();
})->with(['/accounts', '/entries', '/leases/019a0000-0000-7000-8000-000000000001/statement?currency=EUR&from=2026-01-01&to=2026-12-31']);

it('refuse un non-membre : 404 sans révéler l\'organisation', function (): void {
    $etranger = comptaTitulaire(comptaOrganisation());

    $this->actingAs($etranger)->getJson("{$this->base}/accounts")->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    $this->actingAs($etranger)->getJson("{$this->base}/entries/{$this->ecriture->id}")->assertNotFound();
});

it('refuse le gestionnaire : 403', function (string $chemin): void {
    $this->actingAs(comptaMembre($this->org, MemberRole::Manager))->getJson($this->base.$chemin)
        ->assertForbidden()->assertJsonPath('code', 'role_forbidden');
})->with(['/accounts', '/entries', '/entries/019a0000-0000-7000-8000-000000000001', '/leases/019a0000-0000-7000-8000-000000000001/statement']);

it('ouvre la lecture au titulaire, à l\'administrateur et au comptable', function (MemberRole $role): void {
    $compte = $role === MemberRole::Owner ? comptaTitulaire($this->org) : comptaMembre($this->org, $role);

    $this->actingAs($compte)->getJson("{$this->base}/accounts")->assertOk();
    $this->actingAs($compte)->getJson("{$this->base}/entries")->assertOk();
})->with([MemberRole::Owner, MemberRole::Admin, MemberRole::Accountant]);

it('liste le plan de comptes avec les soldes par devise', function (): void {
    $reponse = $this->actingAs(comptaMembre($this->org, MemberRole::Accountant))->getJson("{$this->base}/accounts")->assertOk();

    $produits = collect($reponse->json('data'))->firstWhere('role', 'rent_revenue');

    expect($produits['code'])->toBe('4000')
        ->and($produits['normal_side'])->toBe('credit')
        ->and($produits['balances'])->toBe([
            ['amount' => 95000, 'currency' => 'EUR'],
            ['amount' => 150000, 'currency' => 'XOF'],
        ]);
});

it('pagine les écritures par curseur, de la plus récente à la plus ancienne', function (): void {
    $compte = comptaMembre($this->org, MemberRole::Accountant);

    $page1 = $this->actingAs($compte)->getJson("{$this->base}/entries?per_page=2")->assertOk()
        ->assertJsonCount(2, 'data')->assertJsonPath('data.0.entry_date', '2026-11-03')->assertJsonPath('data.0.lines_count', 2);
    $curseur = $page1->json('meta.next_cursor');

    expect($curseur)->not->toBeNull();

    $this->actingAs($compte)->getJson("{$this->base}/entries?per_page=2&cursor={$curseur}")->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.reference', '2026-000001')->assertJsonPath('meta.next_cursor', null);

    $this->actingAs($compte)->getJson("{$this->base}/entries?cursor=falsifie")->assertUnprocessable();
});

it('filtre les écritures par bail, journal et période', function (): void {
    $compte = comptaMembre($this->org, MemberRole::Accountant);

    $this->actingAs($compte)->getJson("{$this->base}/entries?lease={$this->bail}")->assertOk()->assertJsonCount(1, 'data');
    $this->actingAs($compte)->getJson("{$this->base}/entries?journal=bank")->assertOk()->assertJsonCount(0, 'data');
    $this->actingAs($compte)->getJson("{$this->base}/entries?from=2026-11-02&to=2026-11-02")->assertOk()->assertJsonCount(1, 'data');
    $this->actingAs($compte)->getJson("{$this->base}/entries?journal=inconnu")->assertUnprocessable();
});

it('détaille une écriture avec ses lignes et montants {amount, currency}', function (): void {
    $this->actingAs(comptaTitulaire($this->org))->getJson("{$this->base}/entries/{$this->ecriture->id}")->assertOk()
        ->assertJsonPath('data.reference', '2026-000001')
        ->assertJsonPath('data.source.type', 'installment')
        ->assertJsonCount(2, 'data.lines')
        ->assertJsonPath('data.lines.0.account.role', 'tenant_receivable')
        ->assertJsonPath('data.lines.0.debit', ['amount' => 90000, 'currency' => 'EUR'])
        ->assertJsonPath('data.lines.0.credit', ['amount' => 0, 'currency' => 'EUR'])
        ->assertJsonPath('data.lines.0.lease_id', $this->bail);
});

it('répond 404 pour l\'écriture d\'une autre organisation ou un identifiant mal formé', function (): void {
    $autre = comptaOrganisation();
    $etrangere = comptaPoster($autre, comptaLoyer('autre:1', Money::EUR(100)));
    $titulaire = comptaTitulaire($this->org);

    $this->actingAs($titulaire)->getJson("{$this->base}/entries/{$etrangere->id}")->assertNotFound()->assertJsonPath('code', ErrorCode::EntryNotFound->value);
    $this->actingAs($titulaire)->getJson("{$this->base}/entries/pas-un-uuid")->assertNotFound();
    $this->actingAs($titulaire)->getJson("{$this->base}/entries")->assertJsonMissing(['id' => $etrangere->id]);
});

it('édite l\'extrait du grand livre d\'un bail', function (): void {
    $this->actingAs(comptaMembre($this->org, MemberRole::Accountant))
        ->getJson("{$this->base}/leases/{$this->bail}/statement?currency=EUR&from=2026-11-01&to=2026-11-30")->assertOk()
        ->assertJsonPath('data.opening_balance', ['amount' => 0, 'currency' => 'EUR'])
        ->assertJsonCount(1, 'data.lines')
        ->assertJsonPath('data.lines.0.balance', ['amount' => 90000, 'currency' => 'EUR'])
        ->assertJsonPath('data.closing_balance', ['amount' => 90000, 'currency' => 'EUR']);
});

it('valide les paramètres de l\'extrait', function (string $requete): void {
    $this->actingAs(comptaTitulaire($this->org))->getJson("{$this->base}/leases/{$this->bail}/statement?{$requete}")->assertUnprocessable();
})->with([
    'sans devise' => ['from=2026-11-01&to=2026-11-30'],
    'devise inconnue' => ['currency=ZZZ&from=2026-11-01&to=2026-11-30'],
    'période inversée' => ['currency=EUR&from=2026-11-30&to=2026-11-01'],
    'sans période' => ['currency=EUR'],
]);

it('ne propose aucune écriture par HTTP', function (): void {
    $this->actingAs(comptaTitulaire($this->org))->postJson("{$this->base}/entries", [])->assertStatus(405);
    $this->actingAs(comptaTitulaire($this->org))->deleteJson("{$this->base}/entries/{$this->ecriture->id}")->assertStatus(405);
});
