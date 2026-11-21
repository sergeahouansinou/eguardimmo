<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->lot = M::lot($this->org);
    $this->partie = M::partie($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs(M::titulaire($this->org));
});

it('affiche le détail d\'un mandat avec ses lots, ses conditions et son historique', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie, ['note' => 'Interne', 'custom_fields' => []]);

    $this->getJson(M::url($this->org, "/{$mandat->id}"))
        ->assertOk()
        ->assertJsonPath('data.id', $mandat->id)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.signed_on', '2025-12-15')
        ->assertJsonPath('data.mandant.display_name', $this->partie->display_name)
        ->assertJsonPath('data.mandate_type.key', 'rental_management')
        ->assertJsonPath('data.mandate_type.label', 'Gestion locative')
        ->assertJsonPath('data.units.0.unit.id', $this->lot->id)
        ->assertJsonPath('data.units.0.end_date', null)
        ->assertJsonPath('data.terms.fee_basis_points', 700)
        ->assertJsonCount(1, 'data.terms_history')
        ->assertJsonPath('data.termination', null)
        ->assertJsonPath('data.note', 'Interne')
        ->assertJsonMissingPath('data.organization_id');
});

it('masque la note interne au comptable, qui lit le reste', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie, ['note' => 'Interne', 'termination_note' => 'Confidentiel']);
    M::basculer($this, M::membre($this->org, MemberRole::Accountant));

    $this->getJson(M::url($this->org, "/{$mandat->id}"))
        ->assertOk()
        ->assertJsonPath('data.note', null)
        ->assertJsonPath('data.reference', $mandat->reference)
        ->assertJsonPath('data.terms.fee_basis_points', 700);

    M::basculer($this, M::membre($this->org, MemberRole::Manager));
    $this->getJson(M::url($this->org, "/{$mandat->id}"))->assertOk()->assertJsonPath('data.note', 'Interne');
});

it('liste les mandats récents d\'abord, sans les archivés, avec filtres par statut, mandant, lot et référence', function (): void {
    $autre = M::partie($this->org);
    $a = M::actif($this->org, $this->lot, $this->partie, ['reference' => 'M-2026-0001']);
    $b = M::mandat($this->org, M::lot($this->org), $autre, ['reference' => 'M-2026-0002']);
    $c = M::mandat($this->org, M::lot($this->org), $autre, ['reference' => 'M-2026-0003', 'archived_at' => now()]);

    $ids = fn (string $requete = '') => collect($this->getJson(M::url($this->org, $requete))->assertOk()->json('data'))->pluck('id')->all();

    expect($ids())->toBe([$b->id, $a->id])
        ->and($ids('?status=active'))->toBe([$a->id])
        ->and($ids('?status=draft'))->toBe([$b->id])
        ->and($ids("?mandant={$autre->id}"))->toBe([$b->id])
        ->and($ids("?unit={$this->lot->id}"))->toBe([$a->id])
        ->and($ids('?q=0001'))->toBe([$a->id])
        ->and($ids('?q=%25'))->toBe([])
        ->and($ids('?archived=1'))->toBe([$c->id]);
});

it('pagine par curseur sans doublon ni trou', function (): void {
    foreach (range(1, 5) as $i) {
        M::mandat($this->org, M::lot($this->org), $this->partie, ['reference' => sprintf('M-2026-%04d', $i)]);
    }

    $premiere = $this->getJson(M::url($this->org, '?per_page=2'))->assertOk();
    $suivante = $this->getJson(M::url($this->org, '?per_page=2&cursor='.urlencode((string) $premiere->json('meta.next_cursor'))))->assertOk();
    $derniere = $this->getJson(M::url($this->org, '?per_page=2&cursor='.urlencode((string) $suivante->json('meta.next_cursor'))))->assertOk();

    $references = array_merge(...array_map(fn ($p) => array_column($p->json('data'), 'reference'), [$premiere, $suivante, $derniere]));

    expect($references)->toBe(['M-2026-0005', 'M-2026-0004', 'M-2026-0003', 'M-2026-0002', 'M-2026-0001'])
        ->and($derniere->json('meta.next_cursor'))->toBeNull();
});

it('refuse des filtres et un curseur invalides', function (string $requete): void {
    $this->getJson(M::url($this->org, $requete))->assertUnprocessable();
})->with([
    'statut inconnu' => ['?status=zombie'],
    'mandant mal formé' => ['?mandant=abc'],
    'trop par page' => ['?per_page=101'],
    'curseur falsifié' => ['?cursor='.'%25%25%25'],
    'curseur injecté' => ['?cursor=eyJpZCI6IngnIE9SIDE9MSAtLSIsIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0'],
]);

it('répond mandate_not_found pour un mandat inconnu', function (): void {
    $this->getJson(M::url($this->org, '/'.Str::uuid7()))->assertNotFound()->assertJsonPath('code', 'mandate_not_found');
    $this->getJson(M::url($this->org, '/pas-un-uuid'))->assertNotFound();
});

it('liste les mandants avec leur nombre de mandats, tous et en cours', function (): void {
    $autre = M::partie($this->org);
    M::actif($this->org, $this->lot, $this->partie);
    M::mandat($this->org, M::lot($this->org), $this->partie);
    M::mandat($this->org, M::lot($this->org), $this->partie, ['starts_on' => '2024-01-01', 'ends_on' => '2025-01-01'], MandateStatus::Expired);
    M::mandat($this->org, M::lot($this->org), $this->partie, ['archived_at' => now()]);
    M::mandat($this->org, M::lot($this->org), $autre, [], MandateStatus::Terminated);

    $lignes = collect($this->getJson(M::url($this->org, '/mandants'))->assertOk()->json('data'))->keyBy('party_id');

    expect($lignes)->toHaveCount(2)
        ->and($lignes[$this->partie->id])->toBe(['party_id' => $this->partie->id, 'display_name' => $this->partie->display_name, 'mandate_count' => 3, 'running_mandate_count' => 1])
        ->and($lignes[$autre->id]['mandate_count'])->toBe(1)
        ->and($lignes[$autre->id]['running_mandate_count'])->toBe(1);

    $this->getJson(M::url($this->org, '/mandants?limit=1'))->assertOk()->assertJsonCount(1, 'data');
    $this->getJson(M::url($this->org, '/mandants?limit=0'))->assertUnprocessable();
});
