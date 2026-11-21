<?php

declare(strict_types=1);

use App\Modules\Parties\Models\Party;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Planning\PlanningContext as P;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->actingAs(C::titulaire($this->org));
    $this->site = C::site($this->org);
    $this->lot = C::lot($this->org, $this->site);
    $this->bail = L::bail($this->org);
    R::occuper($this->org, $this->bail, $this->lot, ['valid_from' => '2026-01-01']);
    $this->autreSite = C::site($this->org);
    $this->autreLot = C::lot($this->org, $this->autreSite);
});

it('refuse un bail qui n\'occupe pas le lot indiqué, pour un événement comme pour une tâche', function (string $chemin, array $corps): void {
    $this->postJson(P::url($this->org, $chemin), [...$corps, 'unit_id' => $this->autreLot->id, 'lease_id' => $this->bail->id])->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
    $this->postJson(P::url($this->org, $chemin), [...$corps, 'unit_id' => $this->lot->id, 'lease_id' => $this->bail->id])->assertCreated();
})->with([
    'événement' => ['/events', fn () => P::evenement()],
    'tâche' => ['/tasks', fn () => P::tache()],
]);

it('refuse un bail dont aucun lot n\'est dans le bien indiqué, accepte celui dont un lot y est', function (): void {
    $this->postJson(P::url($this->org, '/events'), P::evenement(['property_id' => $this->autreSite->id, 'lease_id' => $this->bail->id]))->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
    $this->postJson(P::url($this->org, '/tasks'), P::tache(['property_id' => $this->autreSite->id, 'lease_id' => $this->bail->id]))->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
    $this->postJson(P::url($this->org, '/events'), P::evenement(['property_id' => $this->site->id, 'lease_id' => $this->bail->id]))->assertCreated();
    $this->postJson(P::url($this->org, '/tasks'), P::tache(['property_id' => $this->site->id, 'lease_id' => $this->bail->id]))->assertCreated();
});

it('refuse un bail sans lot quand un bien ou un lot est indiqué, accepte le bail seul', function (): void {
    $nu = L::bail($this->org);

    $this->postJson(P::url($this->org, '/events'), P::evenement(['unit_id' => $this->lot->id, 'lease_id' => $nu->id]))->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
    $this->postJson(P::url($this->org, '/events'), P::evenement(['property_id' => $this->site->id, 'lease_id' => $nu->id]))->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
    $this->postJson(P::url($this->org, '/events'), P::evenement(['lease_id' => $nu->id]))->assertCreated();
});

it('applique la cohérence à la modification d\'un événement et d\'une tâche', function (): void {
    $evenement = $this->postJson(P::url($this->org, '/events'), P::evenement(['unit_id' => $this->lot->id, 'lease_id' => $this->bail->id]))->assertCreated()->json('data');
    $tache = $this->postJson(P::url($this->org, '/tasks'), P::tache(['unit_id' => $this->lot->id, 'lease_id' => $this->bail->id]))->assertCreated()->json('data');

    $this->patchJson(P::url($this->org, "/events/{$evenement['id']}"), ['lock_version' => 1, 'unit_id' => $this->autreLot->id])->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
    $this->patchJson(P::url($this->org, "/tasks/{$tache['id']}"), ['lock_version' => 1, 'unit_id' => $this->autreLot->id])->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
});

it('refuse une fiche anonymisée ou archivée comme participant', function (string $colonne): void {
    $fiche = C::partie($this->org);
    $this->postJson(P::url($this->org, '/events'), P::evenement(['attendees' => [['party_id' => $fiche->id]]]))->assertCreated();

    C::dans($this->org, fn () => Party::query()->whereKey($fiche->id)->update([$colonne => now()]));

    $this->postJson(P::url($this->org, '/events'), P::evenement(['attendees' => [['party_id' => $fiche->id]]]))->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
    $existant = $this->postJson(P::url($this->org, '/events'), P::evenement())->assertCreated()->json('data');
    $this->patchJson(P::url($this->org, "/events/{$existant['id']}"), ['lock_version' => 1, 'attendees' => [['party_id' => $fiche->id]]])->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
})->with(['anonymized_at', 'archived_at']);
