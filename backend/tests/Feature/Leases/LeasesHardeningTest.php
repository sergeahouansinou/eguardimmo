<?php

declare(strict_types=1);

use App\Modules\Leases\Queries\Tenancies;
use App\Shared\Audit\AuditLog;
use App\Shared\Audit\RecordModelChange;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeaseDraftContext as D;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs($this->titulaire);
});

it('masque les champs personnalisés dans le journal d\'activité sans les perdre dans le bail', function (): void {
    $bail = L::bail($this->org, ['reference' => 'BL-2026-0001']);
    L::dans($this->org, fn () => $bail->update(['custom_fields' => ['code_acces' => 'SECRET-ZETA-77']]));

    $entree = AuditLog::query()->forSubject('lease', $bail->id)->newestFirst()->firstOrFail();

    expect($entree->changes['custom_fields']['new'])->toBe(RecordModelChange::MASQUE)
        ->and(json_encode(DB::table('audit_logs')->get()))->not->toContain('SECRET-ZETA-77')
        ->and(json_decode((string) DB::table('leases')->where('id', $bail->id)->value('custom_fields'), true))->toBe(['code_acces' => 'SECRET-ZETA-77']);
});

it('plafonne le nombre de clés de jurisdiction_data et de custom_fields à la création et à la modification', function (): void {
    $payload = D::payload(L::lot($this->org), L::partie($this->org));
    $cles = fn (int $n): array => array_combine(array_map(fn (int $i): string => "cle_{$i}", range(1, $n)), array_fill(0, $n, 'x'));
    $bail = L::bail($this->org);

    $this->postJson(R::url($this->org), [...$payload, 'jurisdiction_data' => $cles(21)])->assertUnprocessable()->assertJsonValidationErrors('jurisdiction_data');
    $this->postJson(R::url($this->org), [...$payload, 'custom_fields' => $cles(51)])->assertUnprocessable()->assertJsonValidationErrors('custom_fields');
    $this->patchJson(R::url($this->org, "/{$bail->id}"), ['lock_version' => $bail->lock_version, 'jurisdiction_data' => $cles(21)])->assertUnprocessable()->assertJsonValidationErrors('jurisdiction_data');
    $this->patchJson(R::url($this->org, "/{$bail->id}"), ['lock_version' => $bail->lock_version, 'custom_fields' => $cles(51)])->assertUnprocessable()->assertJsonValidationErrors('custom_fields');
});

it('refuse un curseur dont la date n\'est pas une date, accepte celui que la pagination produit', function (): void {
    foreach (range(1, 3) as $i) {
        R::bailSigne($this->org, ['reference' => "BL-2026-000{$i}", 'starts_on' => "2026-0{$i}-01"]);
    }
    $forge = fn (array $colonnes): string => rtrim(strtr(base64_encode((string) json_encode([...$colonnes, '_pointsToNextItems' => true])), '+/', '-_'), '=');

    foreach (["x' OR 1=1 --", 'pas-une-date', '2026-13-45', '2026-01-01; DROP TABLE leases'] as $date) {
        $this->getJson(R::url($this->org, '?cursor='.urlencode($forge(['starts_on' => $date, 'id' => fake()->uuid()]))))->assertUnprocessable()->assertJsonValidationErrors('cursor');
    }

    $this->getJson(R::url($this->org, '?cursor='.urlencode($forge(['starts_on' => '2026-02-01', 'id' => 'pas-un-uuid']))))->assertUnprocessable();
    $this->getJson(R::url($this->org, '?cursor='.urlencode($forge(['starts_on' => '2026-02-01', 'id' => fake()->uuid(), 'organization_id' => fake()->uuid()]))))->assertUnprocessable();

    $page = $this->getJson(R::url($this->org, '?per_page=1'))->assertOk();
    $suite = $this->getJson(R::url($this->org, '?per_page=1&cursor='.urlencode((string) $page->json('meta.next_cursor'))))->assertOk();

    expect($page->json('meta.next_cursor'))->not->toBeNull()
        ->and($suite->json('data.0.id'))->not->toBe($page->json('data.0.id'));
});

it('limite la lecture de l\'occupation et des locations par un compteur dédié, sans toucher à celui des écritures', function (): void {
    $partie = L::partie($this->org);
    $lecture = R::url($this->org, "/tenancies?parties[]={$partie->id}");

    foreach (range(1, 120) as $i) {
        $this->getJson($lecture)->assertOk();
    }

    $this->getJson($lecture)->assertStatus(429);
    $this->getJson(R::url($this->org, '/occupancy?units[]='.L::lot($this->org)->id.'&date=2026-11-16'))->assertStatus(429);
    $this->postJson(R::url($this->org), [])->assertUnprocessable();
    $this->getJson(R::url($this->org))->assertOk();
});

it('plafonne le nombre de baux renvoyés par partie, en gardant les plus récents', function (): void {
    $partie = L::partie($this->org);
    $debut = CarbonImmutable::parse('2020-01-01');

    foreach (range(0, Tenancies::MAX_LINES_PER_PARTY + 1) as $i) {
        $bail = R::bailSigne($this->org, ['reference' => sprintf('BL-2020-%03d', $i), 'starts_on' => $debut->addMonths($i)->toDateString(), 'ends_on' => null]);
        R::lier($this->org, $bail, $partie, ['valid_from' => $debut->addMonths($i)->toDateString()]);
    }

    $reponse = $this->getJson(R::url($this->org, "/tenancies?parties[]={$partie->id}"))->assertOk();
    $references = array_column($reponse->json('data.0.leases'), 'reference');

    expect($references)->toHaveCount(Tenancies::MAX_LINES_PER_PARTY)
        ->and($references[0])->toBe(sprintf('BL-2020-%03d', Tenancies::MAX_LINES_PER_PARTY + 1))
        ->and($references)->not->toContain('BL-2020-000')
        ->and($references)->not->toContain('BL-2020-001');
});
