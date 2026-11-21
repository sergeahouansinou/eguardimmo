<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Illuminate\Testing\TestResponse;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
    F::encaisserEtCloturer($this, $this->org, $this->bail);
});

function ligne(object $test, array $ids, string $action, array $corps, string $cle): TestResponse
{
    return F::envoyer($test, 'POST', F::url($test->org, "/batches/{$ids['batch']}/items/{$ids['item']}/{$action}"), $corps, $cle);
}

it('même clé et contenu différent : 409 sur l\'exécution', function (): void {
    $ids = F::lotValide($this);

    ligne($this, $ids, 'execute', ['executed_on' => '2026-12-10', 'reference' => 'VIR-1'], 'cle-execution-1')->assertOk();
    ligne($this, $ids, 'execute', ['executed_on' => '2026-12-10', 'reference' => 'VIR-2'], 'cle-execution-1')->assertStatus(409)->assertJsonPath('code', 'owner_funds_idempotency_key_reused');
});

it('même clé et contenu différent : 409 sur l\'échec', function (): void {
    $ids = F::lotValide($this);

    ligne($this, $ids, 'fail', ['reason' => 'IBAN refusé'], 'cle-echec-0001')->assertOk();
    ligne($this, $ids, 'fail', ['reason' => 'Autre motif'], 'cle-echec-0001')->assertStatus(409)->assertJsonPath('code', 'owner_funds_idempotency_key_reused');
});

it('même clé et contenu différent : 409 sur le retour bancaire', function (): void {
    $ids = F::lotValide($this);
    F::executer($this, $ids)->assertOk();

    ligne($this, $ids, 'return', ['reason' => 'Compte clôturé'], 'cle-retour-001')->assertOk();
    ligne($this, $ids, 'return', ['reason' => 'Autre motif'], 'cle-retour-001')->assertStatus(409)->assertJsonPath('code', 'owner_funds_idempotency_key_reused');
});

it('même clé et contenu différent : 409 sur l\'annulation', function (): void {
    $lot = F::lotValide($this)['batch'];
    $version = $this->getJson(F::url($this->org, "/batches/{$lot}"))->json('data.lock_version');

    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$lot}/cancel"), ['reason' => 'Erreur de saisie', 'lock_version' => $version], 'cle-annulation-1')->assertOk();
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$lot}/cancel"), ['reason' => 'Autre motif', 'lock_version' => $version], 'cle-annulation-1')->assertStatus(409)->assertJsonPath('code', 'owner_funds_idempotency_key_reused');
});

it('même clé et contenu différent : 409 sur le prélèvement des honoraires', function (): void {
    F::lotValide($this);
    F::envoyer($this, 'POST', F::url($this->org, '/trust/withdrawals'), ['amount' => 100, 'executed_on' => '2026-12-10', 'reference' => 'PRE-1'], 'cle-prelevement-1')->assertCreated();
    F::envoyer($this, 'POST', F::url($this->org, '/trust/withdrawals'), ['amount' => 200, 'executed_on' => '2026-12-10', 'reference' => 'PRE-1'], 'cle-prelevement-1')->assertStatus(409)->assertJsonPath('code', 'owner_funds_idempotency_key_reused');
});

it('même clé et contenu différent : 409 sur la confirmation d\'un apport', function (): void {
    $a = F::envoyer($this, 'POST', F::url($this->org, '/trust/deposits'), ['amount' => 500, 'executed_on' => '2026-12-10', 'reference' => 'APP-1'])->assertCreated()->json('data.id');
    $b = F::envoyer($this, 'POST', F::url($this->org, '/trust/deposits'), ['amount' => 700, 'executed_on' => '2026-12-10', 'reference' => 'APP-2'])->assertCreated()->json('data.id');

    F::envoyer($this, 'POST', F::url($this->org, "/trust/deposits/{$a}/confirm"), [], 'cle-confirmation-1')->assertOk();
    F::envoyer($this, 'POST', F::url($this->org, "/trust/deposits/{$b}/confirm"), [], 'cle-confirmation-1')->assertStatus(409)->assertJsonPath('code', 'owner_funds_idempotency_key_reused');
});

it('même clé et contenu différent : 409 sur la clôture d\'un mois', function (): void {
    $this->travelTo(CarbonImmutable::parse('2027-02-05 10:00:00'));
    $url = "/api/v1/org/{$this->org->id}/accounting/periods/close";

    F::envoyer($this, 'POST', $url, ['month' => '2026-12'], 'cle-cloture-001')->assertSuccessful();
    F::envoyer($this, 'POST', $url, ['month' => '2027-01'], 'cle-cloture-001')->assertStatus(409)->assertJsonPath('code', 'owner_funds_idempotency_key_reused');
});

it('une ligne d\'un autre lot de la même organisation est introuvable sur chaque action', function (string $action, array $corps): void {
    $premier = F::lotValide($this);
    $version = $this->getJson(F::url($this->org, "/batches/{$premier['batch']}"))->json('data.lock_version');
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$premier['batch']}/cancel"), ['reason' => 'Lot remplacé', 'lock_version' => $version])->assertOk();
    $second = F::lotValide($this);

    ligne($this, ['batch' => $premier['batch'], 'item' => $second['item']], $action, $corps, 'cle-croisee-'.$action)->assertNotFound()->assertJsonPath('code', 'payout_item_not_found');
})->with([
    'execute' => ['execute', ['executed_on' => '2026-12-10']],
    'fail' => ['fail', ['reason' => 'IBAN refusé']],
    'return' => ['return', ['reason' => 'Compte clôturé']],
    'include' => ['include', ['lock_version' => 1]],
    'exclude' => ['exclude', ['lock_version' => 1]],
]);
