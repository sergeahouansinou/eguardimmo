<?php

declare(strict_types=1);

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeaseDraftContext as D;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseSignContext as S;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Leases\LeaseTermsReviseContext as T;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->lot = L::lot($this->org);
    $this->partie = L::partie($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
});

/**
 * @return list<array{0: string, 1: string, 2: array<string, mixed>}>
 */
function leaseHttpEcritures(string $id): array
{
    return [
        ['post', '', []],
        ['patch', "/{$id}", ['lock_version' => 1]],
        ['post', "/{$id}/duplicate", ['starts_on' => '2026-12-01']],
        ['post', "/{$id}/sign", ['signed_on' => '2026-11-10', 'lock_version' => 1]],
        ['post', "/{$id}/cancel", ['lock_version' => 1]],
        ['post', "/{$id}/archive", []],
        ['delete', "/{$id}/archive", []],
        ['post', "/{$id}/terms/revise", ['lock_version' => 1, 'effective_on' => '2026-07-01', 'reason' => 'revision', 'changes' => [['component_term_id' => (string) Str::uuid7(), 'amount' => 66500]]]],
    ];
}

function leaseHttpUrl(object $test, string $chemin = ''): string
{
    return R::url($test->org, $chemin);
}

/**
 * @param  array<string, mixed>  $surcharges
 */
function leaseHttpCreer(object $test, array $surcharges = []): string
{
    return (string) test()->postJson(leaseHttpUrl($test), D::payload($test->lot, $test->partie, $surcharges))->assertCreated()->json('data.id');
}

function leaseHttpLigne(object $test, string $id): Lease
{
    return L::dans($test->org, fn (): Lease => Lease::query()->findOrFail($id));
}

it('exige un jeton, un rôle d\'écriture et l\'appartenance à l\'organisation sur chaque route d\'écriture', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);
    $routes = leaseHttpEcritures($bail->id);

    foreach ($routes as [$methode, $chemin, $corps]) {
        $this->json($methode, leaseHttpUrl($this, $chemin), $corps)->assertUnauthorized();
    }

    R::changerDeCompte($this, L::membre($this->org, MemberRole::Accountant));
    $this->getJson(leaseHttpUrl($this, "/{$bail->id}"))->assertOk();

    foreach ($routes as [$methode, $chemin, $corps]) {
        $this->json($methode, leaseHttpUrl($this, $chemin), $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    R::changerDeCompte($this, L::titulaire(L::organisation()));

    foreach ($routes as [$methode, $chemin, $corps]) {
        $this->json($methode, leaseHttpUrl($this, $chemin), $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }

    expect(leaseHttpLigne($this, $bail->id)->lock_version)->toBe(1);
});

it('autorise l\'écriture au gestionnaire et à l\'administrateur', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);

    foreach ([MemberRole::Manager, MemberRole::Admin] as $i => $role) {
        $compte = L::membre($this->org, $role);
        activerDeuxFacteurs($compte);
        R::changerDeCompte($this, $compte)
            ->patchJson(leaseHttpUrl($this, "/{$bail->id}"), ['lock_version' => $i + 1, 'note' => "Note {$i}"])
            ->assertOk()
            ->assertJsonPath('data.lock_version', $i + 2);
    }
});

it('répond lease_not_found pour le bail d\'une autre organisation et 404 pour un identifiant mal formé', function (): void {
    $etranger = L::bail(L::organisation());
    $this->actingAs($this->titulaire);

    foreach (leaseHttpEcritures($etranger->id) as [$methode, $chemin, $corps]) {
        if ($chemin === '') {
            continue;
        }

        $this->json($methode, leaseHttpUrl($this, $chemin), $corps)->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    }

    foreach (leaseHttpEcritures('pas-un-uuid') as [$methode, $chemin, $corps]) {
        if ($chemin !== '') {
            $this->json($methode, leaseHttpUrl($this, $chemin), $corps)->assertNotFound()->assertJsonPath('code', 'not_found');
        }
    }

    expect(L::dans($this->org, fn () => Lease::query()->count()))->toBe(0);
});

it('crée un brouillon et expose sa Resource avec les lignes de composantes à venir', function (): void {
    $this->actingAs($this->titulaire);

    $reponse = $this->postJson(leaseHttpUrl($this), D::payload($this->lot, $this->partie))->assertCreated()
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.phase', 'draft')
        ->assertJsonPath('data.jurisdiction', 'FR')
        ->assertJsonPath('data.starts_on', '2026-03-01')
        ->assertJsonPath('data.currency', 'EUR')
        ->assertJsonPath('data.due_day', 5)
        ->assertJsonPath('data.lock_version', 1)
        ->assertJsonPath('data.archived_at', null)
        ->assertJsonPath('data.main_unit.id', $this->lot->id)
        ->assertJsonPath('data.units.0.is_main', true)
        ->assertJsonPath('data.parties.0.role', 'tenant')
        ->assertJsonPath('data.parties.0.party.id', $this->partie->id)
        ->assertJsonPath('data.terms.0.amount', ['amount' => 65000, 'currency' => 'EUR'])
        ->assertJsonPath('data.terms.0.component.key', 'rent')
        ->assertJsonPath('data.terms.0.indexed', true);

    expect($reponse->json('data.reference'))->toMatch('/^BL-2026-\d{4}$/')
        ->and($reponse->json('data.terms'))->toHaveCount(1)
        ->and(leaseHttpLigne($this, $reponse->json('data.id'))->organization_id)->toBe($this->org->id);
});

it('ignore les champs que le serveur fixe et rejette les valeurs invalides à la création', function (): void {
    $this->actingAs($this->titulaire);
    $autre = L::organisation();

    $id = leaseHttpCreer($this, ['status' => 'signed', 'reference' => 'PIRATE-1', 'organization_id' => $autre->id, 'currency' => 'USD', 'lock_version' => 9, 'signed_on' => '2026-01-01']);
    $ligne = leaseHttpLigne($this, $id);

    expect($ligne->status->value)->toBe('draft')
        ->and($ligne->reference)->not->toBe('PIRATE-1')
        ->and($ligne->organization_id)->toBe($this->org->id)
        ->and($ligne->currency)->toBe('EUR')
        ->and($ligne->lock_version)->toBe(1)
        ->and($ligne->signed_on)->toBeNull();

    $base = D::payload($this->lot, $this->partie);

    foreach ([
        'units' => [[...$base, 'units' => []], 'units'],
        'periodicité' => [[...$base, 'periodicity' => 'hebdo'], 'periodicity'],
        'jour d\'échéance' => [[...$base, 'due_day' => 31], 'due_day'],
        'début absent' => [array_diff_key($base, ['starts_on' => 1]), 'starts_on'],
        'juridiction' => [[...$base, 'jurisdiction' => 'fr'], 'jurisdiction'],
        'montant négatif' => [[...$base, 'terms' => [['component_term_id' => L::composante('rent')->id, 'amount' => -1]]], 'terms.0.amount'],
    ] as [$corps, $champ]) {
        $this->postJson(leaseHttpUrl($this), $corps)->assertUnprocessable()->assertJsonValidationErrors($champ);
    }

    $this->postJson(leaseHttpUrl($this), [...$base, 'regime_key' => 'fr.inconnu'])->assertUnprocessable()->assertJsonPath('code', 'jurisdiction_unsupported');
    expect(L::dans($this->org, fn () => Lease::query()->count()))->toBe(1);
});

it('modifie un brouillon avec son numéro de version et répond 409 quand il est périmé', function (): void {
    $this->actingAs($this->titulaire);
    $id = leaseHttpCreer($this);
    $url = leaseHttpUrl($this, "/{$id}");

    $this->patchJson($url, ['lock_version' => 1, 'due_day' => 10, 'note' => 'Clés remises', 'status' => 'signed', 'reference' => 'X', 'currency' => 'USD', 'organization_id' => L::organisation()->id])
        ->assertOk()
        ->assertJsonPath('data.due_day', 10)
        ->assertJsonPath('data.note', 'Clés remises')
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.currency', 'EUR')
        ->assertJsonPath('data.lock_version', 2);

    $this->patchJson($url, ['lock_version' => 1, 'note' => 'Périmé'])->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    $this->patchJson($url, ['note' => 'Sans version'])->assertUnprocessable()->assertJsonValidationErrors('lock_version');
    $this->patchJson($url, ['lock_version' => 2, 'due_day' => 0])->assertUnprocessable()->assertJsonValidationErrors('due_day');

    $ligne = leaseHttpLigne($this, $id);
    expect($ligne->note)->toBe('Clés remises')->and($ligne->reference)->not->toBe('X')->and($ligne->lock_version)->toBe(2);
});

it('refuse de modifier la structure d\'un bail signé mais accepte la note', function (): void {
    $this->actingAs($this->titulaire);
    ['bail' => $bail] = S::brouillon($this->org);
    $this->postJson(leaseHttpUrl($this, "/{$bail->id}/sign"), ['signed_on' => '2026-11-10', 'lock_version' => 1])->assertOk();
    $url = leaseHttpUrl($this, "/{$bail->id}");

    $this->patchJson($url, ['lock_version' => 2, 'due_day' => 12])->assertConflict()->assertJsonPath('code', 'lease_not_draft');
    $this->patchJson($url, ['lock_version' => 2, 'note' => 'Avenant verbal'])->assertOk()->assertJsonPath('data.note', 'Avenant verbal');
});

it('duplique un bail en nouveau brouillon avec sa propre référence', function (): void {
    $this->actingAs($this->titulaire);
    $id = leaseHttpCreer($this);
    $url = leaseHttpUrl($this, "/{$id}/duplicate");

    $reponse = $this->postJson($url, ['starts_on' => '2027-03-01', 'status' => 'signed', 'reference' => 'X'])->assertCreated()
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.starts_on', '2027-03-01')
        ->assertJsonPath('data.lock_version', 1)
        ->assertJsonPath('data.main_unit.id', $this->lot->id)
        ->assertJsonPath('data.parties.0.party.id', $this->partie->id)
        ->assertJsonPath('data.terms.0.amount.amount', 65000);

    expect($reponse->json('data.id'))->not->toBe($id)
        ->and($reponse->json('data.reference'))->not->toBe(leaseHttpLigne($this, $id)->reference)
        ->and($reponse->json('data.reference'))->not->toBe('X');

    $this->postJson($url, [])->assertUnprocessable()->assertJsonValidationErrors('starts_on');
    $this->postJson($url, ['starts_on' => '01/03/2027'])->assertUnprocessable()->assertJsonValidationErrors('starts_on');
});

it('signe un brouillon complet puis refuse une seconde signature, une version périmée et une date future', function (): void {
    $this->actingAs($this->titulaire);
    ['bail' => $bail] = S::brouillon($this->org);
    $url = leaseHttpUrl($this, "/{$bail->id}/sign");

    $this->postJson($url, ['signed_on' => '2026-11-10', 'lock_version' => 5])->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    $this->postJson($url, ['signed_on' => '2026-11-17', 'lock_version' => 1])->assertUnprocessable()->assertJsonValidationErrors('signed_on');
    $this->postJson($url, ['lock_version' => 1])->assertUnprocessable()->assertJsonValidationErrors('signed_on');

    $this->postJson($url, ['signed_on' => '2026-11-10', 'lock_version' => 1, 'status' => 'terminated', 'ends_on' => '2026-12-01'])->assertOk()
        ->assertJsonPath('data.status', 'signed')
        ->assertJsonPath('data.signed_on', '2026-11-10')
        ->assertJsonPath('data.end_date', '2028-12-31')
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonPath('data.terms.0.amount.amount', 65000);

    $this->postJson($url, ['signed_on' => '2026-11-10', 'lock_version' => 2])->assertConflict()->assertJsonPath('code', 'lease_not_draft');
});

it('refuse la signature d\'un bail incomplet ou qui chevauche une occupation signée', function (): void {
    $this->actingAs($this->titulaire);
    ['bail' => $sansLoyer] = S::brouillon($this->org);
    S::retirer($this->org, $sansLoyer, 'terms');
    $this->postJson(leaseHttpUrl($this, "/{$sansLoyer->id}/sign"), ['signed_on' => '2026-11-10', 'lock_version' => 1])
        ->assertUnprocessable()->assertJsonPath('code', 'lease_no_rent');

    $lot = L::lot($this->org);
    S::bailSigneSur($this->org, $lot);
    ['bail' => $concurrent] = S::brouillon($this->org, [], $lot);

    $this->postJson(leaseHttpUrl($this, "/{$concurrent->id}/sign"), ['signed_on' => '2026-11-10', 'lock_version' => 1])
        ->assertConflict()->assertJsonPath('code', 'lease_overlap');
    expect(leaseHttpLigne($this, $concurrent->id)->status->value)->toBe('draft');
});

it('annule un brouillon et refuse d\'annuler un bail signé', function (): void {
    $this->actingAs($this->titulaire);
    $id = leaseHttpCreer($this);

    $this->postJson(leaseHttpUrl($this, "/{$id}/cancel"))->assertUnprocessable()->assertJsonValidationErrors('lock_version');
    $this->postJson(leaseHttpUrl($this, "/{$id}/cancel"), ['lock_version' => 9])->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    $this->postJson(leaseHttpUrl($this, "/{$id}/cancel"), ['lock_version' => 1])->assertOk()
        ->assertJsonPath('data.status', 'cancelled')
        ->assertJsonPath('data.lock_version', 2);
    $this->postJson(leaseHttpUrl($this, "/{$id}/cancel"), ['lock_version' => 2])->assertConflict()->assertJsonPath('code', 'lease_not_draft');

    $signe = S::bailSigneSur($this->org, L::lot($this->org));
    $this->postJson(leaseHttpUrl($this, "/{$signe->id}/cancel"), ['lock_version' => $signe->lock_version])->assertConflict()->assertJsonPath('code', 'lease_not_draft');
    expect(leaseHttpLigne($this, $signe->id)->status->value)->toBe('signed');
});

it('archive un bail non signé, le masque de la liste puis le restaure, et refuse d\'archiver un bail signé', function (): void {
    $this->actingAs($this->titulaire);
    $id = leaseHttpCreer($this);
    $url = leaseHttpUrl($this, "/{$id}/archive");

    $this->postJson($url)->assertOk()->assertJsonPath('data.archived_at', fn (?string $date): bool => $date !== null);
    expect($this->getJson(leaseHttpUrl($this))->json('data'))->toBe([]);

    $this->deleteJson($url)->assertOk()->assertJsonPath('data.archived_at', null);
    expect($this->getJson(leaseHttpUrl($this))->json('data.0.id'))->toBe($id);

    $signe = S::bailSigneSur($this->org, L::lot($this->org));
    $this->postJson(leaseHttpUrl($this, "/{$signe->id}/archive"))->assertConflict()->assertJsonPath('code', 'lease_not_archivable');
    expect(leaseHttpLigne($this, $signe->id)->archived_at)->toBeNull();
});

it('révise un loyer indexé et renvoie l\'historique avec la version du bail', function (): void {
    $this->actingAs($this->titulaire);
    $bail = T::bail($this->org);
    T::ligne($this->org, $bail, 'rent', 65000, ['indexed' => true]);
    $url = leaseHttpUrl($this, "/{$bail->id}/terms/revise");

    $this->postJson($url, T::corps($bail, '2026-07-01', [T::changer('rent', 66500)], ['lock_version' => 9]))
        ->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    $this->postJson($url, T::corps($bail, '2026-07-01', []))->assertUnprocessable()->assertJsonValidationErrors('changes');
    $this->postJson($url, T::corps($bail, '2026-07-01', [T::changer('rent', 66500)], ['reason' => 'initial']))->assertUnprocessable()->assertJsonValidationErrors('reason');

    $reponse = $this->postJson($url, T::corps($bail, '2026-07-01', [T::changer('rent', 66500)]))->assertOk()
        ->assertJsonPath('meta.lock_version', 2);

    expect($reponse->json('data'))->toHaveCount(2)
        ->and($reponse->json('data.1.amount'))->toBe(['amount' => 66500, 'currency' => 'EUR'])
        ->and($reponse->json('data.1.valid_from'))->toBe('2026-07-01')
        ->and($reponse->json('data.1.reason'))->toBe('revision')
        ->and($reponse->json('data.1.replaces_id'))->toBe($reponse->json('data.0.id'))
        ->and($reponse->json('data.0.end_date'))->toBe('2026-06-30');
});

it('refuse de réviser les composantes d\'un brouillon', function (): void {
    $this->actingAs($this->titulaire);
    $id = leaseHttpCreer($this);

    $this->postJson(leaseHttpUrl($this, "/{$id}/terms/revise"), T::corps(leaseHttpLigne($this, $id), '2026-07-01', [T::changer('rent', 66500)]))
        ->assertConflict()->assertJsonPath('code', 'lease_not_signed');
    expect(L::dans($this->org, fn () => LeaseTerm::query()->where('lease_id', $id)->count()))->toBe(1);
});

it('parcourt le cycle complet : créer, modifier, signer, réviser un loyer, relire le détail', function (): void {
    $this->actingAs($this->titulaire);
    $id = leaseHttpCreer($this, ['starts_on' => '2025-03-01']);

    $this->patchJson(leaseHttpUrl($this, "/{$id}"), ['lock_version' => 1, 'note' => 'Premier jet'])->assertOk()->assertJsonPath('data.lock_version', 2);
    $this->postJson(leaseHttpUrl($this, "/{$id}/sign"), ['signed_on' => '2025-02-20', 'lock_version' => 2])->assertOk()
        ->assertJsonPath('data.status', 'signed')
        ->assertJsonPath('data.lock_version', 3);
    $this->postJson(leaseHttpUrl($this, "/{$id}/terms/revise"), T::corps(leaseHttpLigne($this, $id), '2026-11-01', [T::changer('rent', 67000)]))->assertOk()
        ->assertJsonPath('meta.lock_version', 4);

    $detail = $this->getJson(leaseHttpUrl($this, "/{$id}"))->assertOk()
        ->assertJsonPath('data.status', 'signed')
        ->assertJsonPath('data.phase', 'running')
        ->assertJsonPath('data.note', 'Premier jet')
        ->assertJsonPath('data.lock_version', 4)
        ->assertJsonPath('data.terms.0.amount', ['amount' => 67000, 'currency' => 'EUR'])
        ->assertJsonPath('data.terms.0.in_force', true);

    expect($detail->json('data.terms'))->toHaveCount(1)
        ->and($this->getJson(leaseHttpUrl($this, "/{$id}/terms"))->json('data'))->toHaveCount(2);
});
