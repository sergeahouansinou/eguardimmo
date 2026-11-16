<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Properties\Models\UnitOwnership;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->lot = C::lot($this->org, C::site($this->org));
    $this->url = C::url($this->org, "/units/{$this->lot->id}/ownerships");
    $this->actingAs($this->titulaire);
});

/**
 * @param  array<string, mixed>  $surcharges
 * @return array<string, mixed>
 */
function propertiesPart(string $partieId, array $surcharges = []): array
{
    return ['party_id' => $partieId, 'share_bp' => 5000, 'nature' => 'full', 'valid_from' => '2024-01-01', ...$surcharges];
}

/**
 * @return list<string>
 */
function propertiesParties(object $org, int $nombre): array
{
    return array_map(fn (): string => C::partie($org)->id, range(1, $nombre));
}

it('déclare un propriétaire, puis le relit à une date donnée', function (): void {
    $partie = C::partie($this->org);

    $id = $this->postJson($this->url, propertiesPart($partie->id, ['share_bp' => 6000, 'valid_to' => '2025-01-01']))
        ->assertCreated()
        ->assertJsonPath('data.party_id', $partie->id)
        ->assertJsonPath('data.share_bp', 6000)
        ->assertJsonPath('data.nature', 'full')
        ->assertJsonPath('data.valid_from', '2024-01-01')
        ->assertJsonPath('data.valid_to', '2025-01-01')
        ->json('data.id');

    expect(C::dans($this->org, fn () => UnitOwnership::query()->findOrFail($id)->organization_id))->toBe($this->org->id)
        ->and($this->getJson($this->url)->json('data.0.id'))->toBe($id)
        ->and($this->getJson("{$this->url}?at=2024-12-31")->json('data'))->toHaveCount(1)
        ->and($this->getJson("{$this->url}?at=2025-01-01")->json('data'))->toBe([])
        ->and($this->getJson("{$this->url}?at=2023-12-31")->json('data'))->toBe([]);
});

it('valide la propriété en liste blanche', function (): void {
    $partie = C::partie($this->org);

    foreach ([
        ['share_bp', 0], ['share_bp', 10001], ['share_bp', 'beaucoup'], ['nature', 'bail'], ['valid_from', '01/01/2024'],
        ['valid_to', '2024-01-01'], ['valid_to', '2023-12-31'], ['party_id', 'pas-un-uuid'],
    ] as [$champ, $valeur]) {
        $this->postJson($this->url, propertiesPart($partie->id, [$champ => $valeur]))->assertUnprocessable()->assertJsonValidationErrors($champ);
    }

    $autre = C::organisation();
    $id = $this->postJson($this->url, propertiesPart($partie->id, ['organization_id' => $autre->id, 'unit_id' => fake()->uuid()]))->assertCreated()->json('data.id');
    expect(C::dans($this->org, fn () => UnitOwnership::query()->findOrFail($id)))->organization_id->toBe($this->org->id)->unit_id->toBe($this->lot->id);
});

it('refuse une partie inconnue, d\'une autre organisation ou anonymisée', function (): void {
    $etrangere = C::partie(C::organisation());
    $anonyme = C::partie($this->org);
    $this->postJson(C::url($this->org, "/parties/{$anonyme->id}/anonymization"))->assertOk();

    foreach ([fake()->uuid(), $etrangere->id] as $partieId) {
        $this->postJson($this->url, propertiesPart($partieId))->assertNotFound()->assertJsonPath('code', 'party_not_found');
    }

    $this->postJson($this->url, propertiesPart($anonyme->id))->assertConflict()->assertJsonPath('code', 'owner_anonymized');
    expect(C::dans($this->org, fn () => UnitOwnership::query()->count()))->toBe(0);
});

it('refuse une propriété sur un lot d\'une autre organisation', function (): void {
    $autre = C::organisation();
    $lotAutre = C::lot($autre, C::site($autre));
    $partie = C::partie($this->org);

    $this->postJson(C::url($this->org, "/units/{$lotAutre->id}/ownerships"), propertiesPart($partie->id))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    $this->postJson(C::url($this->org, '/units/'.fake()->uuid().'/ownerships'), propertiesPart($partie->id))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
});

it('refuse des quotes-parts au-delà de 10000 points de base pour une même période et une même nature', function (): void {
    [$a, $b, $c] = propertiesParties($this->org, 3);

    $this->postJson($this->url, propertiesPart($a, ['share_bp' => 6000]))->assertCreated();
    $this->postJson($this->url, propertiesPart($b, ['share_bp' => 4001]))->assertConflict()->assertJsonPath('code', 'ownership_share_exceeded');
    $this->postJson($this->url, propertiesPart($b, ['share_bp' => 4000]))->assertCreated();
    $this->postJson($this->url, propertiesPart($c, ['share_bp' => 1]))->assertConflict()->assertJsonPath('code', 'ownership_share_exceeded');
    $this->postJson($this->url, propertiesPart($c, ['share_bp' => 1, 'nature' => 'usufruct']))->assertCreated();

    expect(C::dans($this->org, fn () => UnitOwnership::query()->count()))->toBe(3);
});

it('traite la période comme semi-ouverte : la date de fin libère la quote-part', function (): void {
    [$a, $b, $c] = propertiesParties($this->org, 3);

    $this->postJson($this->url, propertiesPart($a, ['share_bp' => 10000, 'valid_from' => '2024-01-01', 'valid_to' => '2025-01-01']))->assertCreated();
    $this->postJson($this->url, propertiesPart($b, ['share_bp' => 10000, 'valid_from' => '2025-01-01']))->assertCreated();
    $this->postJson($this->url, propertiesPart($c, ['share_bp' => 1, 'valid_from' => '2024-12-31', 'valid_to' => '2025-01-02']))->assertConflict();
    $this->postJson($this->url, propertiesPart($c, ['share_bp' => 1, 'valid_from' => '2023-01-01', 'valid_to' => '2024-01-01']))->assertCreated();
});

it('contrôle la somme à chaque début de période recoupée, pas seulement à celui de la nouvelle ligne', function (): void {
    [$a, $b, $c] = propertiesParties($this->org, 3);

    $this->postJson($this->url, propertiesPart($a, ['share_bp' => 4000, 'valid_from' => '2024-06-01', 'valid_to' => '2024-09-01']))->assertCreated();
    $this->postJson($this->url, propertiesPart($b, ['share_bp' => 5000, 'valid_from' => '2024-01-01']))->assertCreated();

    $this->postJson($this->url, propertiesPart($c, ['share_bp' => 2000, 'valid_from' => '2024-01-01', 'valid_to' => '2024-12-01']))->assertConflict()->assertJsonPath('code', 'ownership_share_exceeded');
    $this->postJson($this->url, propertiesPart($c, ['share_bp' => 2000, 'valid_from' => '2024-01-01', 'valid_to' => '2024-06-01']))->assertCreated();
});

it('refuse le même propriétaire deux fois sur une période recoupée avec le même droit', function (): void {
    [$a] = propertiesParties($this->org, 1);

    $this->postJson($this->url, propertiesPart($a, ['share_bp' => 2000]))->assertCreated();
    $this->postJson($this->url, propertiesPart($a, ['share_bp' => 2000, 'valid_from' => '2030-01-01']))->assertConflict()->assertJsonPath('code', 'ownership_overlap');
    $this->postJson($this->url, propertiesPart($a, ['share_bp' => 2000, 'nature' => 'bare']))->assertCreated();
});

it('relit la somme après avoir pris le verrou : une écriture concurrente validée entre-temps est comptée', function (): void {
    [$a, $b, $concurrent] = propertiesParties($this->org, 3);
    $this->postJson($this->url, propertiesPart($a, ['share_bp' => 6000]))->assertCreated();

    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::listen(function ($requete) use (&$declenchee, $niveau, $concurrent): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($requete->sql, 'from "units"')) {
            return;
        }

        $declenchee = true;
        DB::table('unit_ownerships')->insert([
            'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'unit_id' => $this->lot->id, 'party_id' => $concurrent,
            'share_bp' => 4000, 'nature' => 'full', 'valid_from' => '2024-01-01', 'valid_to' => null,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    });

    $this->postJson($this->url, propertiesPart($b, ['share_bp' => 3000]))->assertConflict()->assertJsonPath('code', 'ownership_share_exceeded');

    expect($declenchee)->toBeTrue();
});

it('termine une période à la date donnée, libère la quote-part et refuse une seconde clôture', function (): void {
    [$a, $b] = propertiesParties($this->org, 2);
    $id = $this->postJson($this->url, propertiesPart($a, ['share_bp' => 10000]))->assertCreated()->json('data.id');
    $this->postJson($this->url, propertiesPart($b, ['share_bp' => 1000, 'valid_from' => '2025-06-01']))->assertConflict();

    $fin = "{$this->url}/{$id}/end";
    $this->postJson($fin, ['valid_to' => '2024-01-01'])->assertUnprocessable()->assertJsonPath('code', 'ownership_period_invalid');
    $this->postJson($fin, ['valid_to' => 'demain'])->assertUnprocessable()->assertJsonValidationErrors('valid_to');
    $this->postJson($fin, ['valid_to' => '2025-06-01'])->assertOk()->assertJsonPath('data.valid_to', '2025-06-01');
    $this->postJson($fin, ['valid_to' => '2026-01-01'])->assertConflict()->assertJsonPath('code', 'ownership_closed');

    $this->postJson($this->url, propertiesPart($b, ['share_bp' => 10000, 'valid_from' => '2025-06-01']))->assertCreated();
    expect($this->getJson("{$this->url}?at=2025-05-31")->json('data.0.party_id'))->toBe($a)
        ->and($this->getJson("{$this->url}?at=2025-06-01")->json('data.0.party_id'))->toBe($b);
});

it('refuse de terminer une propriété inconnue ou d\'un autre lot', function (): void {
    [$a] = propertiesParties($this->org, 1);
    $autreLot = C::lot($this->org, C::site($this->org));
    $id = $this->postJson($this->url, propertiesPart($a))->assertCreated()->json('data.id');

    $this->postJson("{$this->url}/".fake()->uuid().'/end', ['valid_to' => '2025-01-01'])->assertNotFound()->assertJsonPath('code', 'ownership_not_found');
    $this->postJson(C::url($this->org, "/units/{$autreLot->id}/ownerships/{$id}/end"), ['valid_to' => '2025-01-01'])->assertNotFound()->assertJsonPath('code', 'ownership_not_found');
});

it('réserve l\'écriture au propriétaire, à l\'administrateur et au gestionnaire', function (): void {
    [$a] = propertiesParties($this->org, 1);

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Accountant));
    $this->getJson($this->url)->assertOk();
    $this->postJson($this->url, propertiesPart($a))->assertForbidden();

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Manager));
    $this->postJson($this->url, propertiesPart($a))->assertCreated();
});
