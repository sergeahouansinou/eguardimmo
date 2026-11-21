<?php

declare(strict_types=1);

use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence(50000);
});

/**
 * @param  array<string, mixed>  $scene
 */
function devisCree(object $test, array $scene, int $prix = 20000, bool $soumis = false): string
{
    $id = C::enDevis($test, $scene, $prix);
    $devis = (string) C::devis($test, $scene, $id, $prix)->assertCreated()->json('data.id');

    if ($soumis) {
        $test->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();
    }

    return $devis;
}

it('liste les devis de l\'organisation avec l\'intervention et sans les lignes', function (): void {
    $devis = devisCree($this, $this->scene, 20000);
    C::comme($this, $this->scene['owner']);

    $reponse = $this->getJson(C::url($this->scene['org'], '/quotes'))->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $devis)
        ->assertJsonPath('data.0.status', 'received')
        ->assertJsonPath('data.0.total_gross.amount', 24000)
        ->assertJsonPath('data.0.intervention.status', 'quoting')
        ->assertJsonPath('data.0.intervention.unit_id', $this->scene['unit']->id)
        ->assertJsonPath('data.0.approval', null)
        ->assertJsonMissingPath('data.0.lines');

    expect(array_keys($reponse->json('data.0.intervention')))->toBe(['id', 'reference', 'status', 'unit_id']);
});

it('expose le plafond figé et l\'échéance de l\'accord du mandant, jamais calculés par le navigateur', function (): void {
    $devis = devisCree($this, $this->scene, 60000, true);
    $accord = InterventionApproval::query()->withoutGlobalScopes()->where('quote_id', $devis)->firstOrFail();
    C::comme($this, $this->scene['owner']);

    $this->getJson(C::url($this->scene['org'], '/quotes'))->assertOk()
        ->assertJsonPath('data.0.status', 'submitted')
        ->assertJsonPath('data.0.approval.status', 'pending')
        ->assertJsonPath('data.0.approval.ceiling_amount', ['amount' => 50000, 'currency' => 'EUR'])
        ->assertJsonPath('data.0.approval.decide_before', $accord->decide_before->toIso8601String());
});

it('filtre par statut, intervention et prestataire', function (): void {
    $recu = devisCree($this, $this->scene, 20000);
    $soumis = devisCree($this, $this->scene, 20000, true);
    $autrePrestataire = C::prestataire($this->scene['org']);
    $chezAutre = devisCree($this, [...$this->scene, 'supplier' => $autrePrestataire], 20000);
    C::comme($this, $this->scene['owner']);
    $url = C::url($this->scene['org'], '/quotes');
    $ids = fn (string $requete): array => collect($this->getJson($url.$requete)->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

    expect($ids(''))->toBe(collect([$recu, $soumis, $chezAutre])->sort()->values()->all())
        ->and($ids('?status[]=submitted'))->toBe([$soumis])
        ->and($ids('?status[]=submitted&status[]=received&supplier_party_id='.$this->scene['supplier']->id))->toBe(collect([$recu, $soumis])->sort()->values()->all())
        ->and($ids('?supplier_party_id='.$autrePrestataire->id))->toBe([$chezAutre])
        ->and($ids('?status[]=accepted'))->toBe([]);

    $interventionId = InterventionQuote::query()->withoutGlobalScopes()->findOrFail($chezAutre)->intervention_id;
    expect($ids('?intervention_id='.$interventionId))->toBe([$chezAutre]);

    $this->getJson($url.'?status[]=inconnu')->assertUnprocessable()->assertJsonValidationErrors('status.0');
    $this->getJson($url.'?intervention_id=pas-un-uuid')->assertUnprocessable()->assertJsonValidationErrors('intervention_id');
    $this->getJson($url.'?cursor=falsifie')->assertUnprocessable()->assertJsonValidationErrors('cursor');
});

it('pagine par curseur stable sur trois pages, sans doublon ni trou', function (): void {
    $crees = [];

    foreach (range(1, 5) as $_) {
        $crees[] = devisCree($this, $this->scene, 20000);
    }

    C::comme($this, $this->scene['owner']);
    $vus = [];
    $curseur = null;

    foreach ([2, 2, 1] as $attendu) {
        $reponse = $this->getJson(C::url($this->scene['org'], '/quotes?per_page=2'.($curseur === null ? '' : '&cursor='.$curseur)))->assertOk()->assertJsonCount($attendu, 'data');
        $page = $reponse->json('data.*.id');
        expect($page)->toBe(collect($page)->sortDesc()->values()->all());
        $vus = [...$vus, ...$page];
        $curseur = $reponse->json('meta.next_cursor');
    }

    expect($curseur)->toBeNull()
        ->and($vus)->toHaveCount(5)->and(array_unique($vus))->toHaveCount(5)
        ->and(collect($vus)->sort()->values()->all())->toBe(collect($crees)->sort()->values()->all());
});

it('ne liste jamais le devis d\'une autre organisation', function (): void {
    $mien = devisCree($this, $this->scene, 20000);
    $autre = C::agence();
    $sien = devisCree($this, $autre, 20000);

    C::comme($this, $this->scene['owner']);
    $this->getJson(C::url($this->scene['org'], '/quotes'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mien);
    $this->getJson(C::url($this->scene['org'], '/quotes?intervention_id='.InterventionQuote::query()->withoutGlobalScopes()->findOrFail($sien)->intervention_id))
        ->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(C::url($this->scene['org'], '/quotes?supplier_party_id='.$autre['supplier']->id))->assertOk()->assertJsonCount(0, 'data');

    $this->getJson(C::url($autre['org'], '/quotes'))->assertNotFound();
});

it('lit en un nombre de requêtes constant pour 1, 10 puis 100 devis', function (): void {
    $compter = function (): int {
        C::comme($this, $this->scene['owner']);
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson(C::url($this->scene['org'], '/quotes?per_page=100'))->assertOk();
        $total = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $total;
    };

    devisCree($this, $this->scene, 60000, true);
    $un = $compter();

    foreach (range(1, 9) as $_) {
        devisCree($this, $this->scene, 20000);
    }

    $dix = $compter();
    $interventionId = InterventionQuote::query()->withoutGlobalScopes()->firstOrFail()->intervention_id;
    $modele = InterventionQuote::query()->withoutGlobalScopes()->where('intervention_id', $interventionId)->firstOrFail();

    foreach (range(1, 90) as $_) {
        $copie = $modele->replicate();
        $copie->forceFill(['reference' => 'COPIE-'.bin2hex(random_bytes(4)), 'status' => 'refused'])->saveQuietly();
    }

    expect($dix)->toBe($un)->and($compter())->toBe($un)->and($un)->toBeLessThanOrEqual(12);
});

it('401 sans session, ouvert aux quatre rôles, 404 pour un compte locataire', function (): void {
    $url = C::url($this->scene['org'], '/quotes');

    auth()->forgetGuards();
    $this->getJson($url)->assertUnauthorized();

    foreach (MemberRole::cases() as $role) {
        $compte = L::membre($this->scene['org'], $role);
        activerDeuxFacteurs($compte);
        C::comme($this, $compte);
        $this->getJson($url)->assertOk();
    }

    C::comme($this, $this->scene['tenant']);
    $this->getJson($url)->assertNotFound();
});
