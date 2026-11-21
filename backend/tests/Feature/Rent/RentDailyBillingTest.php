<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\Term;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Rent\Events\InstallmentOverdue;
use App\Modules\Rent\Models\Installment;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseSignContext as S;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    C::preparer($this);
});

function rentCompter(object $org): int
{
    return L::dans($org, fn (): int => Installment::query()->count());
}

it('la signature d\'un bail programme l\'échéance de la période courante, sans attendre la tâche planifiée', function (OrganizationKind $type): void {
    $org = $this->org = C::organisation($type);
    $this->actingAs(L::titulaire($org));
    ['bail' => $bail] = S::brouillon($org);

    S::appliquer($this, $bail);

    expect(rentCompter($org))->toBe(1)
        ->and(C::echeances($org, $bail)[0]->period_start->toDateString())->toBe('2026-11-01');
})->with([OrganizationKind::Agency, OrganizationKind::Individual]);

it('rent:generate rattrape les baux signés de toutes les organisations et ne crée rien deux fois', function (): void {
    $a = C::organisation();
    $b = C::organisation(OrganizationKind::Individual, 'Particulier');
    ['bail' => $bailA] = C::bail($a);
    ['bail' => $bailB] = C::bail($b);

    $this->artisan('rent:generate')->expectsOutputToContain('2 bail(baux) examiné(s), 2 échéance(s) générée(s)')->assertSuccessful();
    $this->artisan('rent:generate')->expectsOutputToContain('0 échéance(s) générée(s)')->assertSuccessful();

    expect(rentCompter($a))->toBe(1)->and(rentCompter($b))->toBe(1)
        ->and(C::echeances($a, $bailA))->toHaveCount(1)
        ->and(C::echeances($b, $bailB))->toHaveCount(1);
});

it('rent:generate rapporte un bail en échec, sort en erreur et continue les autres', function (): void {
    $org = C::organisation();
    ['bail' => $sain] = C::bail($org);
    ['bail' => $casse] = C::bail($org, charges: 0);
    $libre = Term::factory()->create(['organization_id' => $org->id, 'vocabulary' => VocabularyKey::LeaseComponent->value, 'key' => 'frais_libres', 'labels' => ['fr' => 'Frais libres'], 'metadata' => []]);
    L::dans($org, fn () => LeaseTerm::query()->where('lease_id', $casse->id)->update(['component_term_id' => $libre->id]));

    $this->artisan('rent:generate')->expectsOutputToContain($casse->id)->assertFailed();

    expect(C::echeances($org, $sain))->toHaveCount(1)
        ->and(C::echeances($org, $casse))->toHaveCount(0);
});

it('ignore un bail brouillon ou terminé depuis longtemps', function (): void {
    $org = C::organisation();
    C::bail($org, ['status' => 'draft', 'signed_on' => null]);
    C::bail($org, ['starts_on' => '2024-01-01', 'ends_on' => '2025-01-01']);

    $this->artisan('rent:generate')->expectsOutputToContain('0 bail(baux) examiné(s)')->assertSuccessful();

    expect(rentCompter($org))->toBe(0)
        ->and(L::dans($org, fn () => Lease::query()->count()))->toBe(2);
});

it('signale un impayé une seule fois, à la première détection', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org);
    $this->actingAs(L::titulaire($org));
    [$echeance] = C::emises($org, $bail, $this);
    Event::fake([InstallmentOverdue::class]);

    $this->artisan('rent:generate')->assertSuccessful();
    $this->artisan('rent:generate')->assertSuccessful();

    Event::assertDispatchedTimes(InstallmentOverdue::class, 1);
    Event::assertDispatched(InstallmentOverdue::class, fn (InstallmentOverdue $e): bool => $e->installmentId === $echeance->id && $e->leaseId === $bail->id && $e->organizationId === $org->id && $e->dueDate === '2026-11-05');
});

it('ne signale pas une échéance soldée ni une échéance pas encore échue', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org);
    C::emises($org, $bail, $this);
    C::payer($this, $org, $bail, 70000)->assertCreated();
    Event::fake([InstallmentOverdue::class]);

    $this->artisan('rent:generate')->assertSuccessful();

    Event::assertNotDispatched(InstallmentOverdue::class);
});
