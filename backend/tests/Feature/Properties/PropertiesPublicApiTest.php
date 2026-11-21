<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\UnitTypeSemantic;
use App\Modules\Properties\Data\OwnerShareData;
use App\Modules\Properties\Data\UnitData;
use App\Modules\Properties\Enums\OwnershipNature;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\PublicApi\OwnershipDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Properties\Queries\UnitDetails;
use App\Shared\Http\ApiProblem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->site = C::site($this->org, ['name' => 'Résidence du Port']);
    $this->lot = C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-101', 'floor' => 3, 'surface_hundredths' => 5250]);
    $this->actingAs(C::titulaire($this->org));
});

function propertiesCode(Closure $appel): string
{
    try {
        $appel();
    } catch (ApiProblem $probleme) {
        return $probleme->problemCode;
    }

    return 'aucune erreur';
}

it('lit un lot, son type avec son sens système, l\'adresse du site et son parent, sans exposer de modèle', function (): void {
    $cave = C::lot($this->org, $this->site, 'cellar', ['reference' => 'A-101-C', 'parent_unit_id' => $this->lot->id]);

    $donnee = C::dans($this->org, fn () => app(UnitDirectory::class)->find($cave->id));
    $principal = C::dans($this->org, fn () => app(UnitDirectory::class)->find($this->lot->id));

    expect($donnee)->toBeInstanceOf(UnitData::class)
        ->and($donnee->parentUnitId)->toBe($this->lot->id)
        ->and($donnee->unitTypeKey)->toBe('cellar')
        ->and($donnee->unitTypeSemantic)->toBe(UnitTypeSemantic::Storage)
        ->and($principal->id)->toBe($this->lot->id)
        ->and($principal->propertyId)->toBe($this->site->id)
        ->and($principal->propertyName)->toBe('Résidence du Port')
        ->and($principal->address['city'])->toBe('Marseille')
        ->and($principal->reference)->toBe('A-101')
        ->and($principal->unitTypeKey)->toBe('apartment')
        ->and($principal->unitTypeSemantic)->toBe(UnitTypeSemantic::Residential)
        ->and($principal->floor)->toBe(3)
        ->and($principal->surfaceHundredths)->toBe(5250)
        ->and($principal->parentUnitId)->toBeNull()
        ->and($principal->isArchived)->toBeFalse();
});

it('lit plusieurs lots par identifiant et refuse l\'ensemble si un seul est inconnu', function (): void {
    $second = C::lot($this->org, $this->site, 'parking', ['reference' => 'P-1']);

    $lots = C::dans($this->org, fn () => app(UnitDirectory::class)->findMany([$second->id, $this->lot->id, $second->id]));

    expect(array_keys($lots))->toBe([$second->id, $this->lot->id])
        ->and($lots[$second->id]->unitTypeSemantic)->toBe(UnitTypeSemantic::Parking)
        ->and(C::dans($this->org, fn () => app(UnitDirectory::class)->findMany([])))->toBe([])
        ->and(propertiesCode(fn () => C::dans($this->org, fn () => app(UnitDirectory::class)->findMany([$this->lot->id, fake()->uuid()]))))->toBe('unit_not_found');
});

it('refuse un lot d\'une autre organisation, inconnu ou mal formé par unit_not_found', function (): void {
    $autre = C::organisation();

    foreach ([$this->lot->id, fake()->uuid(), 'pas-un-uuid'] as $id) {
        expect(propertiesCode(fn () => C::dans($autre, fn () => app(UnitDirectory::class)->find($id))))->toBe('unit_not_found')
            ->and(propertiesCode(fn () => C::dans($autre, fn () => app(UnitDirectory::class)->findMany([$id]))))->toBe('unit_not_found')
            ->and(propertiesCode(fn () => C::dans($autre, fn () => app(OwnershipDirectory::class)->ownersAt($id, new DateTimeImmutable('2025-01-01')))))->toBe('unit_not_found');
    }

    expect(propertiesCode(fn () => C::dans($this->org, fn () => app(UnitDirectory::class)->find($this->lot->id))))->toBe('aucune erreur');
});

it('ne déduit aucune occupation du patrimoine', function (): void {
    expect(method_exists(UnitDirectory::class, 'occupancy'))->toBeFalse()
        ->and(method_exists(OwnershipDirectory::class, 'occupancy'))->toBeFalse()
        ->and(Schema::hasColumn('units', 'status'))->toBeFalse()
        ->and(Schema::hasColumn('units', 'is_occupied'))->toBeFalse();
});

it('donne les propriétaires en vigueur à une date, périodes semi-ouvertes', function (): void {
    [$a, $b, $c] = [C::partie($this->org), C::partie($this->org), C::partie($this->org)];
    $url = C::url($this->org, "/units/{$this->lot->id}/ownerships");
    $this->postJson($url, ['party_id' => $a->id, 'share_bp' => 6000, 'nature' => 'full', 'valid_from' => '2024-01-01', 'valid_to' => '2025-01-01'])->assertCreated();
    $this->postJson($url, ['party_id' => $b->id, 'share_bp' => 4000, 'nature' => 'full', 'valid_from' => '2024-01-01'])->assertCreated();
    $this->postJson($url, ['party_id' => $c->id, 'share_bp' => 6000, 'nature' => 'full', 'valid_from' => '2025-01-01'])->assertCreated();
    $quand = fn (string $date): array => C::dans($this->org, fn () => app(OwnershipDirectory::class)->ownersAt($this->lot->id, new DateTimeImmutable($date)));

    $avant = $quand('2023-12-31');
    $dedans = $quand('2024-12-31');
    $apres = $quand('2025-01-01');

    expect($avant)->toBe([])
        ->and($dedans)->toHaveCount(2)
        ->and($dedans[0])->toBeInstanceOf(OwnerShareData::class)
        ->and(collect($dedans)->mapWithKeys(fn (OwnerShareData $part): array => [$part->partyId => $part->shareBp])->all())->toEqual([$a->id => 6000, $b->id => 4000])
        ->and($dedans[0]->nature)->toBe(OwnershipNature::Full)
        ->and(collect($apres)->mapWithKeys(fn (OwnerShareData $part): array => [$part->partyId => $part->shareBp])->all())->toEqual([$b->id => 4000, $c->id => 6000]);
});

function compterRequetes(Closure $appel): int
{
    $nombre = 0;
    DB::listen(function () use (&$nombre): void {
        $nombre++;
    });
    $appel();

    return $nombre;
}

it('lit un lot ou six lots d\'autant de sites et de types avec le même nombre de requêtes', function (): void {
    $types = ['apartment', 'cellar', 'parking', 'apartment', 'cellar', 'parking'];
    $lots = array_map(fn (string $type): Unit => C::lot($this->org, C::site($this->org), $type), $types);
    $ids = array_map(fn (Unit $lot): string => $lot->id, $lots);
    $lire = fn (array $liste): int => compterRequetes(fn () => C::dans($this->org, fn () => app(UnitDirectory::class)->findMany($liste)));

    $lire($ids);
    $unSeul = $lire([$ids[0]]);
    $six = $lire($ids);

    expect(count(C::dans($this->org, fn () => app(UnitDirectory::class)->findMany($ids))))->toBe(6)
        ->and($six)->toBe($unSeul);
});

it('résout les types d\'une liste de lots sans requête par ligne', function (): void {
    $types = ['apartment', 'cellar', 'parking', 'apartment', 'cellar', 'parking'];
    $lots = array_map(fn (string $type): Unit => C::lot($this->org, $this->site, $type), $types);
    $detail = fn (array $liste): int => compterRequetes(fn () => C::dans($this->org, fn () => app(UnitDetails::class)->typesOf($liste)));

    $detail($lots);

    expect($detail([$lots[0]]))->toBe($detail($lots))
        ->and(array_keys(C::dans($this->org, fn () => app(UnitDetails::class)->typesOf($lots))))->toHaveCount(3);
});

it('liste les lots d\'un bien par référence, jamais ceux d\'un autre bien, et refuse un bien inconnu', function (): void {
    $autreSite = C::site($this->org, ['name' => 'Résidence du Parc']);
    $b = C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-102']);
    $etranger = C::lot($this->org, $autreSite, 'apartment', ['reference' => 'P-001']);

    $lots = C::dans($this->org, fn (): array => app(UnitDirectory::class)->ofProperty($this->site->id));

    expect(array_map(fn (UnitData $l): string => $l->id, $lots))->toBe([$this->lot->id, $b->id])->and(array_map(fn (UnitData $l): string => $l->id, $lots))->not->toContain($etranger->id)
        ->and(propertiesCode(fn () => C::dans($this->org, fn () => app(UnitDirectory::class)->ofProperty((string) Str::uuid7()))))->toBe('property_not_found')
        ->and(propertiesCode(fn () => C::dans($this->org, fn () => app(UnitDirectory::class)->ofProperty('pas-un-uuid'))))->toBe('property_not_found');
});
