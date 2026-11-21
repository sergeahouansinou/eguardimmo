<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    L::semer();
    $this->travelTo(CarbonImmutable::parse(T::AUJOURDHUI));
    $this->org = T::organisation();
    $this->moi = T::locataire($this->org, ['note' => 'Locataire à surveiller', 'custom_fields' => ['code_interne' => 'X-42'], 'jurisdiction_data' => ['secret' => 'oui']]);
});

it('liste mes baux avec l\'organisation, le lot principal et mon accès', function (): void {
    $this->actingAs($this->moi['user'])->getJson('/api/v1/tenant/leases')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $this->moi['lease']->id)
        ->assertJsonPath('data.0.phase', 'running')
        ->assertJsonPath('data.0.organization.name', 'Agence du Port')
        ->assertJsonPath('data.0.main_unit.reference', fn (string $ref): bool => $ref !== '')
        ->assertJsonPath('data.0.end_date', '2028-12-31')
        ->assertJsonPath('data.0.access', ['until' => '2029-12-31', 'in_grace' => false]);
});

it('montre le détail du bail : lot, conditions courantes et parties visibles, sans donnée interne', function (): void {
    $colocataire = T::colocataire($this->org, $this->moi['lease']);
    $garant = T::colocataire($this->org, $this->moi['lease'], role: LeasePartyRole::Guarantor, attributs: ['guarantee_limit_amount' => Money\Money::EUR(900000), 'guarantee_ends_on' => '2029-01-01']);
    R::terme($this->org, $this->moi['lease'], 'charges_provision', [...R::loyer(8000), 'valid_from' => '2026-01-01']);

    $reponse = $this->actingAs($this->moi['user'])->getJson("/api/v1/tenant/leases/{$this->moi['lease']->id}")->assertOk();

    $reponse->assertJsonPath('data.id', $this->moi['lease']->id)
        ->assertJsonPath('data.due_day', 5)
        ->assertJsonCount(1, 'data.units')
        ->assertJsonCount(2, 'data.terms')
        ->assertJsonPath('data.terms.0.amount', ['amount' => 65000, 'currency' => 'EUR'])
        ->assertJsonCount(3, 'data.parties');

    $roles = collect($reponse->json('data.parties'))->mapWithKeys(fn (array $p): array => [$p['display_name'] => [$p['role'], $p['is_me']]])->all();
    expect($roles[$this->moi['party']->display_name])->toBe(['tenant', true])
        ->and($roles[$colocataire->display_name])->toBe(['tenant', false])
        ->and($roles[$garant->display_name])->toBe(['guarantor', false]);

    $corps = (string) $reponse->getContent();
    foreach (['Locataire à surveiller', 'code_interne', 'X-42', 'secret', 'guarantee', 'limit', '900000', 'note', 'custom_fields', 'jurisdiction_data', 'lock_version', 'signed_file_id', 'email'] as $interdit) {
        expect($corps)->not->toContain($interdit);
    }
    expect($corps)->not->toContain($colocataire->id)->not->toContain($garant->id);
});

it('masque un colocataire sorti et les conditions qui ne sont plus en vigueur', function (): void {
    $parti = T::colocataire($this->org, $this->moi['lease'], ['valid_to' => '2026-06-01']);
    R::terme($this->org, $this->moi['lease'], 'charges_provision', [...R::loyer(5000), 'valid_from' => '2026-01-01', 'valid_to' => '2026-07-01']);

    $reponse = $this->actingAs($this->moi['user'])->getJson("/api/v1/tenant/leases/{$this->moi['lease']->id}")->assertOk();

    expect(collect($reponse->json('data.parties'))->pluck('display_name')->all())->not->toContain($parti->display_name);
    $reponse->assertJsonCount(1, 'data.terms');
});

it('exige une session, un compte vérifié et le profil locataire', function (): void {
    $this->getJson('/api/v1/tenant/leases')->assertUnauthorized();
    $this->getJson("/api/v1/tenant/leases/{$this->moi['lease']->id}")->assertUnauthorized();

    T::comme($this, User::factory()->create())->getJson('/api/v1/tenant/leases')->assertForbidden()->assertJsonPath('code', 'space_forbidden');
    T::comme($this, User::factory()->unverified()->create())->getJson('/api/v1/tenant/leases')->assertForbidden()->assertJsonPath('code', 'email_unverified');
});

it('refuse un jeton opérateur', function (): void {
    $operateur = $this->moi['user'];
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($operateur);
    T::comme($this, null);

    $this->withToken($operateur->createToken('console', ['operator'])->plainTextToken)
        ->getJson('/api/v1/tenant/leases')->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
});

it('répond 404 pour le bail d\'un autre locataire, d\'une autre organisation ou inconnu, sans les distinguer', function (): void {
    $autreOrg = T::organisation('Immo Loire');
    $autre = T::locataire($autreOrg);
    $voisin = T::locataire($this->org);
    $inconnu = (string) Str::uuid7();

    foreach ([$autre['lease']->id, $voisin['lease']->id, $inconnu] as $id) {
        T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/leases/{$id}")
            ->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    }

    T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/leases/pas-un-uuid')->assertNotFound();
    T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/leases')->assertJsonCount(1, 'data');
});

it('ne montre jamais un bail où ma partie n\'est que garant ou occupant, ni un brouillon, ni un bail annulé', function (): void {
    $garant = T::locataire($this->org, [], ['role' => LeasePartyRole::Guarantor]);
    $brouillon = T::locataire($this->org, ['status' => LeaseStatus::Draft], [], $this->moi['user']->fresh());
    $annule = T::locataire($this->org, ['status' => LeaseStatus::Cancelled], [], $this->moi['user']->fresh());

    expect($garant['user']->id)->not->toBe($this->moi['user']->id);
    T::comme($this, $garant['user'])->getJson('/api/v1/tenant/leases')->assertOk()->assertJsonCount(0, 'data');
    T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/leases')->assertOk()->assertJsonCount(1, 'data');
    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/leases/{$brouillon['lease']->id}")->assertNotFound();
    T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/leases/{$annule['lease']->id}")->assertNotFound();
});

it('lit les baux de plusieurs organisations et pagine par curseur', function (): void {
    $autreOrg = T::organisation('Immo Loire');
    $ailleurs = T::locataire($autreOrg, ['starts_on' => '2025-06-01', 'ends_on' => '2030-06-01'], [], null);
    $lien = T::locataire($this->org, ['starts_on' => '2024-01-01', 'ends_on' => '2027-01-01'], [], $this->moi['user']);
    expect($ailleurs['party']->organization_id)->not->toBe($this->moi['party']->organization_id);

    $compte = $this->moi['user'];
    $partieAilleurs = T::partie($autreOrg, ['user_id' => $compte->id]);
    R::lier($autreOrg, $ailleurs['lease'], $partieAilleurs, ['valid_from' => '2025-06-01']);

    $page1 = T::comme($this, $compte)->getJson('/api/v1/tenant/leases?per_page=2')->assertOk();
    $page1->assertJsonCount(2, 'data');
    $suivante = $page1->json('links.next') ?? $page1->json('meta.next_cursor');
    expect($suivante)->not->toBeNull();

    $curseur = $page1->json('meta.next_cursor');
    $page2 = T::comme($this, $compte)->getJson('/api/v1/tenant/leases?per_page=2&cursor='.$curseur)->assertOk();
    $page2->assertJsonCount(1, 'data');

    $ids = collect([...$page1->json('data'), ...$page2->json('data')])->pluck('id')->all();
    expect($ids)->toHaveCount(3)->and(array_unique($ids))->toHaveCount(3)
        ->and(collect([...$page1->json('data'), ...$page2->json('data')])->pluck('organization.name')->unique()->sort()->values()->all())->toBe(['Agence du Port', 'Immo Loire']);
});

it('refuse un curseur forgé', function (): void {
    $this->actingAs($this->moi['user'])->getJson('/api/v1/tenant/leases?cursor=abc')->assertUnprocessable();
});
