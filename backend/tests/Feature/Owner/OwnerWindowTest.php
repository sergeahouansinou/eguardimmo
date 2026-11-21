<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Support\GracePeriod;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Mandates\Support\OwnerWindow;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    L::semer();
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = T::organisation();
    $this->compte = User::factory()->create(['email' => 'awa@exemple.fr']);
    $this->mandant = O::mandant($this->org);
    $this->acces = O::acces($this->org, $this->mandant, $this->compte);
    $this->visibles = fn (?string $org = null, ?string $jour = null): array => app(MandateDirectory::class)->visibleToOwner($this->compte->id, $org, $jour === null ? null : CarbonImmutable::parse($jour));
});

it('voit le mandant tant qu\'un mandat est actif ou suspendu, sans limite de date', function (MandateStatus $statut): void {
    O::mandat($this->org, $this->mandant, $statut, ['starts_on' => '2020-01-01', 'ends_on' => '2021-01-01']);

    $visible = ($this->visibles)()[0] ?? null;

    expect($visible?->accessUntil)->toBeNull()->and($visible?->inGrace)->toBeFalse()->and($visible?->canWrite())->toBeTrue()
        ->and($visible?->organizationId)->toBe($this->org->id)->and($visible?->mandantPartyId)->toBe($this->mandant->id);
})->with([MandateStatus::Active, MandateStatus::Suspended]);

it('ne tire aucune fenêtre d\'un mandat d\'une autre organisation qui porterait le même identifiant de mandant', function (): void {
    $autreOrg = T::organisation();
    O::mandat($autreOrg, O::mandant($autreOrg), MandateStatus::Active, ['mandant_party_id' => $this->mandant->id]);

    expect(($this->visibles)())->toBe([]);

    O::mandat($this->org, $this->mandant);

    $visibles = ($this->visibles)();
    expect($visibles)->toHaveCount(1)->and($visibles[0]->organizationId)->toBe($this->org->id);
});

it('ne voit rien sans mandat, avec un brouillon seul, un mandat archivé seul ou un accès révoqué', function (): void {
    expect(($this->visibles)())->toBe([]);

    O::mandat($this->org, $this->mandant, MandateStatus::Draft);
    O::mandat($this->org, $this->mandant, MandateStatus::Active, ['archived_at' => now()]);
    expect(($this->visibles)())->toBe([]);

    O::mandat($this->org, $this->mandant);
    expect(($this->visibles)())->toHaveCount(1);
    L::dans($this->org, fn () => $this->acces->forceFill(['status' => 'revoked', 'revoked_at' => now(), 'revoked_by' => 'organization'])->save());
    expect(($this->visibles)())->toBe([]);
});

it('garde l\'accès 12 mois après le dernier jour du mandat, jour compris, puis le ferme le lendemain', function (): void {
    O::mandat($this->org, $this->mandant, MandateStatus::Terminated, ['starts_on' => '2025-01-01', 'ends_on' => '2026-01-01']);

    $veille = ($this->visibles)(null, '2026-12-31')[0] ?? null;
    expect($veille?->accessUntil?->toDateString())->toBe('2026-12-31')->and($veille?->inGrace)->toBeTrue()->and($veille?->canWrite())->toBeFalse();
    expect(($this->visibles)(null, '2026-12-31'))->toHaveCount(1);
    expect(($this->visibles)(null, '2027-01-01'))->toBe([]);
    expect(($this->visibles)(null, '2026-01-01'))->toHaveCount(1);
});

it('applique la règle de la grâce du locataire autour du 29 février', function (string $dernierJour, string $attendu): void {
    expect(OwnerWindow::until($dernierJour)->toDateString())->toBe($attendu)->and(GracePeriod::until($dernierJour))->toBe($attendu);
})->with([
    ['2028-02-29', '2029-02-28'],
    ['2027-02-28', '2028-02-28'],
    ['2027-03-01', '2028-03-01'],
    ['2026-12-31', '2027-12-31'],
]);

it('ferme la fenêtre au jour exact après un dernier jour au 29 février', function (): void {
    O::mandat($this->org, $this->mandant, MandateStatus::Expired, ['starts_on' => '2027-03-01', 'ends_on' => '2028-03-01']);

    expect(($this->visibles)(null, '2029-02-28'))->toHaveCount(1)->and(($this->visibles)(null, '2029-03-01'))->toBe([]);
});

it('prend le dernier mandat parmi plusieurs et reste ouvert tant qu\'un autre court', function (): void {
    O::mandat($this->org, $this->mandant, MandateStatus::Expired, ['starts_on' => '2020-01-01', 'ends_on' => '2021-01-01']);
    O::mandat($this->org, $this->mandant, MandateStatus::Terminated, ['starts_on' => '2025-01-01', 'ends_on' => '2026-06-01']);

    expect(($this->visibles)(null, '2027-05-31'))->toHaveCount(1)->and(($this->visibles)(null, '2027-06-01'))->toBe([]);

    O::mandat($this->org, $this->mandant, MandateStatus::Active, ['starts_on' => '2026-06-01', 'ends_on' => '2029-06-01']);
    $visible = ($this->visibles)(null, '2030-01-01')[0] ?? null;
    expect($visible?->accessUntil)->toBeNull()->and($visible?->inGrace)->toBeFalse();
});

it('reste en accès complet pendant le préavis d\'un mandat résilié, puis passe en grâce', function (): void {
    O::mandat($this->org, $this->mandant, MandateStatus::Terminated, ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);

    $pendant = ($this->visibles)(null, '2026-12-31')[0];
    $apres = ($this->visibles)(null, '2027-01-01')[0];

    expect($pendant->inGrace)->toBeFalse()->and($pendant->accessUntil?->toDateString())->toBe('2027-12-31')->and($pendant->canWrite())->toBeTrue()
        ->and($apres->inGrace)->toBeTrue()->and($apres->canWrite())->toBeFalse();
});

it('garde la lecture seule du co-indivisaire quel que soit l\'état du mandat et refuse son écriture', function (): void {
    $co = User::factory()->create();
    O::acces($this->org, $this->mandant, $co, OwnerAccessRole::CoOwner);
    O::mandat($this->org, $this->mandant);
    $directory = app(MandateDirectory::class);
    $visible = $directory->visibleToOwner($co->id)[0];

    expect($visible->role)->toBe(OwnerAccessRole::CoOwner)->and($visible->canWrite())->toBeFalse()->and($visible->inGrace)->toBeFalse();
    expect(fn () => $directory->assertOwnerWritable($visible))->toThrow(fn (ApiProblem $p): bool => $p->problemCode === 'owner_role_forbidden' && $p->status === 403);
});

it('refuse l\'écriture en grâce par owner_access_read_only et l\'accepte pour le titulaire en cours de mandat', function (): void {
    O::mandat($this->org, $this->mandant, MandateStatus::Terminated, ['starts_on' => '2025-01-01', 'ends_on' => '2026-06-01']);
    $directory = app(MandateDirectory::class);

    expect(fn () => $directory->assertOwnerWritable(($this->visibles)()[0]))->toThrow(fn (ApiProblem $p): bool => $p->problemCode === 'owner_access_read_only' && $p->status === 403);

    O::mandat($this->org, $this->mandant);
    expect($directory->assertOwnerWritable(($this->visibles)()[0]))->toBeNull();
});

it('ne mélange pas les mandants : un mandat d\'un autre mandant ou d\'une autre agence ne donne rien', function (): void {
    $autreOrg = T::organisation('Immo Loire');
    $autreMandant = O::mandant($this->org, 'bob@exemple.fr');
    O::mandat($this->org, $autreMandant);
    $parOrg = O::mandant($autreOrg, 'awa@exemple.fr');
    O::mandat($autreOrg, $parOrg);

    expect(($this->visibles)())->toBe([]);

    O::mandat($this->org, $this->mandant);
    expect(array_map(fn ($v): string => $v->mandantPartyId, ($this->visibles)()))->toBe([$this->mandant->id]);
});

it('garde chaque agence séparée pour un même compte et restreint seulement par ?agency=', function (): void {
    $autreOrg = T::organisation('Immo Loire');
    $autreMandant = O::mandant($autreOrg, 'awa@exemple.fr');
    O::acces($autreOrg, $autreMandant, $this->compte);
    O::mandat($this->org, $this->mandant);
    O::mandat($autreOrg, $autreMandant, MandateStatus::Terminated, ['starts_on' => '2025-01-01', 'ends_on' => '2026-06-01']);

    $reponse = T::comme($this, $this->compte)->getJson('/api/v1/owner/agencies')->assertOk()->assertJsonCount(2, 'data');
    expect(collect($reponse->json('data'))->pluck('agency.id')->sort()->values()->all())->toBe(collect([$this->org->id, $autreOrg->id])->sort()->values()->all());
    expect(collect($reponse->json('data'))->firstWhere('agency.id', $autreOrg->id))->toMatchArray(['in_grace' => true, 'read_only' => true]);
    expect(collect($reponse->json('data'))->firstWhere('agency.id', $this->org->id))->toMatchArray(['in_grace' => false, 'read_only' => false]);
    expect(array_keys($reponse->json()))->toBe(['data']);

    T::comme($this, $this->compte)->getJson('/api/v1/owner/agencies?agency='.$autreOrg->id)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.agency.id', $autreOrg->id);
    T::comme($this, $this->compte)->getJson('/api/v1/owner/agencies?agency='.$this->org->id)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.agency.name', 'Agence du Port');
});

it('répond 404 pour une agence hors de la clé, mal formée ou à la fenêtre échue', function (): void {
    $etrangere = T::organisation('Immo Loire');
    O::mandat($this->org, $this->mandant);
    $echue = T::organisation('Immo Sud');
    $mandantEchu = O::mandant($echue, 'awa@exemple.fr');
    O::acces($echue, $mandantEchu, $this->compte);
    O::mandat($echue, $mandantEchu, MandateStatus::Expired, ['starts_on' => '2020-01-01', 'ends_on' => '2021-01-01']);
    $c = fn (string $agence) => T::comme($this, $this->compte)->getJson('/api/v1/owner/agencies?agency='.$agence);

    $c($etrangere->id)->assertNotFound()->assertJsonPath('code', 'owner_agency_not_found');
    $c($echue->id)->assertNotFound()->assertJsonPath('code', 'owner_agency_not_found');
    $c((string) Str::uuid7())->assertNotFound();
    $c('pas-un-uuid')->assertNotFound();
    T::comme($this, $this->compte)->getJson('/api/v1/owner/agencies')->assertOk()->assertJsonCount(1, 'data');
});

it('garde un nombre de requêtes constant avec 1, 10 et 100 mandants', function (int $total): void {
    foreach (range(1, $total) as $i) {
        $mandant = O::mandant($this->org, "m{$i}@exemple.fr");
        O::acces($this->org, $mandant, $this->compte);
        O::mandat($this->org, $mandant);
    }

    DB::enableQueryLog();
    DB::flushQueryLog();
    $visibles = ($this->visibles)();
    $requetes = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($visibles)->toHaveCount($total)->and($requetes)->toBe(2);
})->with([1, 10, 100]);

it('garde un nombre de requêtes constant sur la route /owner/agencies avec 1, 10 et 100 mandants', function (): void {
    $mesures = [];

    foreach ([1, 10, 100] as $palier) {
        $existants = (int) array_key_last($mesures);
        foreach (range($existants + 1, $palier) as $i) {
            $mandant = O::mandant($this->org, "m{$i}@exemple.fr");
            O::acces($this->org, $mandant, $this->compte);
            O::mandat($this->org, $mandant);
        }
        T::comme($this, $this->compte);
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson('/api/v1/owner/agencies')->assertOk()->assertJsonCount($palier, 'data');
        $mesures[$palier] = count(DB::getQueryLog());
        DB::disableQueryLog();
    }

    expect(array_unique($mesures))->toHaveCount(1);
});
