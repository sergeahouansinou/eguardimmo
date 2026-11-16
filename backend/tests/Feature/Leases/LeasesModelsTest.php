<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\TermChangeReason;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Shared\Audit\AuditLog;
use App\Shared\Audit\RecordModelChange;
use App\Shared\Tenancy\MissingOrganizationContext;
use App\Shared\Tenancy\OrganizationMismatch;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->autre = L::organisation();
    $this->bail = L::bail($this->org, ['reference' => 'BL-2026-0001']);
});

it('crée des modèles valides depuis les factories', function (): void {
    $lot = L::lot($this->org);
    $partie = L::partie($this->org);

    L::dans($this->org, function () use ($lot, $partie): void {
        $unite = LeaseUnit::factory()->create(['lease_id' => $this->bail->id, 'unit_id' => $lot->id]);
        $locataire = LeaseParty::factory()->create(['lease_id' => $this->bail->id, 'party_id' => $partie->id]);
        $terme = LeaseTerm::factory()->create(['lease_id' => $this->bail->id, 'component_term_id' => L::composante()->id]);

        expect($this->bail->fresh()->status)->toBe(LeaseStatus::Draft)
            ->and($this->bail->fresh()->organization_id)->toBe($this->org->id)
            ->and($unite->fresh()->is_main)->toBeTrue()
            ->and($locataire->fresh()->role)->toBe(LeasePartyRole::Tenant)
            ->and($terme->fresh()->reason)->toBe(TermChangeReason::Initial)
            ->and($this->bail->units()->count())->toBe(1)
            ->and($this->bail->parties()->count())->toBe(1)
            ->and($this->bail->terms()->count())->toBe(1);
    });
});

it('stocke les dates en jour seul et rend le bail signé par l\'état de la factory', function (): void {
    $signe = L::bail($this->org, ['status' => LeaseStatus::Signed, 'signed_on' => '2025-12-15', 'reference' => 'BL-2026-0002']);

    $brut = DB::table('leases')->where('id', $signe->id)->first();

    expect($brut->starts_on)->toBe('2026-01-01')
        ->and($brut->signed_on)->toBe('2025-12-15')
        ->and($signe->fresh()->starts_on->toDateString())->toBe('2026-01-01');
});

it('lit un montant en unités mineures avec sa devise, et la garantie avec la sienne', function (): void {
    L::dans($this->org, function (): void {
        $terme = LeaseTerm::factory()->create([
            'lease_id' => $this->bail->id,
            'component_term_id' => L::composante()->id,
            'amount' => Money::EUR(65050),
        ]);
        $garant = LeaseParty::factory()->create([
            'lease_id' => $this->bail->id,
            'role' => LeasePartyRole::Guarantor,
            'guarantee_limit_amount' => Money::EUR(1200000),
        ]);

        $brut = DB::table('lease_terms')->where('id', $terme->id)->first();
        $brutGarant = DB::table('lease_parties')->where('id', $garant->id)->first();

        expect($brut->amount)->toBe(65050)->and($brut->currency)->toBe('EUR')
            ->and($brutGarant->guarantee_limit_amount)->toBe(1200000)->and($brutGarant->guarantee_currency)->toBe('EUR')
            ->and($terme->fresh()->amount->equals(Money::EUR(65050)))->toBeTrue()
            ->and($garant->fresh()->guarantee_limit_amount?->equals(Money::EUR(1200000)))->toBeTrue()
            ->and(LeaseParty::factory()->create(['lease_id' => $this->bail->id])->fresh()->guarantee_limit_amount)->toBeNull();
    });
});

it('cloisonne les baux et leurs lignes par organisation', function (): void {
    L::dans($this->org, fn () => LeaseUnit::factory()->create(['lease_id' => $this->bail->id]));
    $autreBail = L::bail($this->autre, ['reference' => 'BL-2026-0001']);

    expect(L::dans($this->autre, fn (): array => Lease::query()->pluck('id')->all()))->toBe([$autreBail->id])
        ->and(L::dans($this->autre, fn (): int => LeaseUnit::query()->count()))->toBe(0)
        ->and(L::dans($this->autre, fn (): ?Lease => Lease::query()->find($this->bail->id)))->toBeNull()
        ->and(fn () => Lease::query()->count())->toThrow(MissingOrganizationContext::class);
});

it('refuse en base une ligne rattachée au bail d\'une autre organisation', function (): void {
    $ligne = fn (string $organisation) => DB::table('lease_units')->insert([
        'id' => (string) Str::uuid7(), 'organization_id' => $organisation, 'lease_id' => $this->bail->id,
        'unit_id' => (string) Str::uuid7(), 'is_main' => false, 'valid_from' => '2026-01-01',
        'created_at' => now(), 'updated_at' => now(),
    ]);

    expect($ligne($this->org->id))->toBeTrue()
        ->and(fn () => $ligne($this->autre->id))->toThrow(QueryException::class);
});

it('refuse la création d\'un bail dans une autre organisation que le contexte', function (): void {
    expect(fn () => L::dans($this->org, fn () => Lease::factory()->create(['organization_id' => $this->autre->id, 'reference' => 'BL-2026-0009'])))
        ->toThrow(OrganizationMismatch::class);
});

it('garde une référence unique par organisation seulement', function (): void {
    expect(fn () => L::bail($this->org, ['reference' => 'BL-2026-0001']))->toThrow(QueryException::class)
        ->and(L::bail($this->autre, ['reference' => 'BL-2026-0001'])->reference)->toBe('BL-2026-0001');
});

it('n\'admet qu\'un seul lot principal ouvert par bail, l\'historique fermé restant libre', function (): void {
    $lotA = (string) Str::uuid7();
    $lotB = (string) Str::uuid7();
    $creer = fn (array $attributs) => L::dans($this->org, fn () => LeaseUnit::factory()->create(['lease_id' => $this->bail->id, ...$attributs]));

    $premier = $creer(['unit_id' => $lotA, 'is_main' => true, 'valid_from' => '2026-01-01']);

    expect(DB::table('lease_units')->where('id', $premier->id)->value('main_of_lease'))->toBe($this->bail->id)
        ->and(fn () => $creer(['unit_id' => $lotB, 'is_main' => true]))->toThrow(QueryException::class);

    $creer(['unit_id' => $lotB, 'is_main' => false]);
    $creer(['unit_id' => (string) Str::uuid7(), 'is_main' => false]);

    L::dans($this->org, fn () => $premier->update(['valid_to' => '2026-06-01']));
    $creer(['unit_id' => $lotB, 'is_main' => true, 'valid_from' => '2026-06-01']);

    expect(DB::table('lease_units')->whereNotNull('main_of_lease')->count())->toBe(1)
        ->and(DB::table('lease_units')->where('lease_id', $this->bail->id)->count())->toBe(4);
});

it('refuse deux fois la même ligne de lot pour une même date de début', function (): void {
    $lot = (string) Str::uuid7();
    L::dans($this->org, fn () => LeaseUnit::factory()->create(['lease_id' => $this->bail->id, 'unit_id' => $lot, 'is_main' => false]));

    expect(fn () => L::dans($this->org, fn () => LeaseUnit::factory()->create(['lease_id' => $this->bail->id, 'unit_id' => $lot, 'is_main' => false])))
        ->toThrow(QueryException::class);
});

it('chaîne une composante révisée à celle qu\'elle remplace, une seule fois', function (): void {
    L::dans($this->org, function (): void {
        $ancienne = LeaseTerm::factory()->create(['lease_id' => $this->bail->id, 'component_term_id' => L::composante()->id, 'valid_to' => '2027-01-01']);
        $nouvelle = fn () => LeaseTerm::factory()->create([
            'lease_id' => $this->bail->id, 'component_term_id' => L::composante()->id, 'valid_from' => '2027-01-01',
            'reason' => TermChangeReason::Revision, 'replaces_id' => $ancienne->id,
        ]);

        expect($nouvelle()->replaces_id)->toBe($ancienne->id)
            ->and($nouvelle(...))->toThrow(QueryException::class);
    });
});

it('masque la note et le motif de fin dans le journal d\'activité, sans les perdre dans le bail', function (): void {
    L::dans($this->org, fn () => $this->bail->update(['note' => 'Code du portail sésame', 'termination_reason' => 'Départ pour raison médicale']));

    $entree = AuditLog::query()->forSubject('lease', $this->bail->id)->newestFirst()->firstOrFail();

    expect($entree->changes['note'])->toBe(['old' => null, 'new' => RecordModelChange::MASQUE])
        ->and($entree->changes['termination_reason'])->toBe(['old' => null, 'new' => RecordModelChange::MASQUE])
        ->and(json_encode(DB::table('audit_logs')->get()))->not->toContain('sésame')->not->toContain('médicale')
        ->and(DB::table('leases')->where('id', $this->bail->id)->value('note'))->toBe('Code du portail sésame');
});

it('résout les alias de la morph map des quatre modèles', function (): void {
    expect(array_map(fn (string $alias): ?string => Relation::getMorphedModel($alias), ['lease', 'lease_unit', 'lease_party', 'lease_term']))
        ->toBe([Lease::class, LeaseUnit::class, LeaseParty::class, LeaseTerm::class]);
});
