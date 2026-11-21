<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Investments\InvestmentsContext as I;
use Tests\Feature\Mandates\MandatesSecurityContext as X;

beforeEach(function (): void {
    I::preparer($this);
});

it('401 sans jeton sur chaque route', function (): void {
    $b = I::bailleur();
    $id = '0199f5d2-0000-7000-8000-000000000001';

    foreach ([['GET', '/acquisitions'], ['POST', '/acquisitions'], ['GET', "/acquisitions/{$id}"], ['PATCH', "/acquisitions/{$id}"], ['GET', '/loans'], ['POST', '/loans'], ['GET', "/loans/{$id}"], ['GET', "/loans/{$id}/schedule"],
        ['POST', "/loans/{$id}/schedule/import"], ['POST', "/loans/{$id}/prepayments"], ['POST', "/loans/{$id}/fees"], ['POST', "/loans/{$id}/attestations"], ['POST', "/loans/{$id}/void"]] as [$methode, $chemin]) {
        expect($this->json($methode, I::url($b['org'], $chemin))->status())->toBe(401, "{$methode} {$chemin}");
    }
});

it('un gestionnaire lit mais n\'écrit pas ; un comptable écrit ; l\'agence est refusée avec investments_landlord_only', function (): void {
    $b = I::bailleur();
    $gestionnaire = I::membre($b['org'], MemberRole::Manager);
    $comptable = I::membre($b['org'], MemberRole::Accountant);
    $admin = I::membre($b['org'], MemberRole::Admin);

    I::comme($this, $gestionnaire);
    $this->getJson(I::url($b['org'], '/loans'))->assertOk();
    $this->getJson(I::url($b['org'], '/acquisitions'))->assertOk();
    I::pret($this, $b)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    $this->postJson(I::url($b['org'], '/acquisitions'), [], ['Idempotency-Key' => 'abcdefgh1'])->assertForbidden()->assertJsonPath('code', 'role_forbidden');

    I::comme($this, $comptable);
    I::pret($this, $b)->assertCreated();

    I::comme($this, $admin);
    I::pret($this, $b)->assertCreated();

    $a = I::agence();
    I::comme($this, $a['owner']);
    $this->getJson(I::url($a['org'], '/loans'))->assertForbidden()->assertJsonPath('code', 'investments_landlord_only');
    I::pret($this, $a)->assertForbidden()->assertJsonPath('code', 'investments_landlord_only');
});

it('un utilisateur étranger à l\'organisation est refusé', function (): void {
    $b = I::bailleur();
    $autre = I::bailleur('M. Autre');
    I::comme($this, $autre['owner']);

    $this->getJson(I::url($b['org'], '/loans'))->assertNotFound();
});

it('404 sur chaque route par identifiant pour la ressource d\'une autre organisation, rien n\'est modifié', function (): void {
    $a = I::bailleur();
    I::comme($this, $a['owner']);
    $pret = I::pret($this, $a)->assertCreated()->json('data.id');
    $acq = $this->postJson(I::url($a['org'], '/acquisitions'), ['property_id' => $a['property'], 'acquired_on' => '2020-05-01', 'price' => 20000000], ['Idempotency-Key' => 'acq-intrusion-1'])->assertCreated()->json('data.id');

    $b = I::bailleur('M. Autre');
    I::comme($this, $b['owner']);
    $url = fn (string $chemin): string => I::url($b['org'], $chemin);
    $corps = [
        'prepayments' => ['lock_version' => 1, 'date' => '2026-04-05', 'amount' => 1000, 'option' => 'reduce_term'],
        'fees' => ['kind' => 'dossier', 'paid_on' => '2026-01-01', 'amount' => 100],
        'attestations' => ['income_year' => 2026, 'interest' => 1, 'document' => I::pdf()],
        'void' => ['lock_version' => 1, 'reason' => 'Intrusion'],
        'import' => ['lock_version' => 1, 'file' => UploadedFile::fake()->createWithContent('t.csv', "2026-01-05;1;1;0;0;0\n")],
        'acquisitions' => ['acquired_on' => '2020-05-01', 'price' => 5, 'lock_version' => 1],
    ];
    $appels = [['GET', "/loans/{$pret}", []], ['GET', "/loans/{$pret}/schedule", []], ['POST', "/loans/{$pret}/prepayments", $corps['prepayments']], ['POST', "/loans/{$pret}/fees", $corps['fees']],
        ['POST', "/loans/{$pret}/attestations", $corps['attestations']], ['POST', "/loans/{$pret}/void", $corps['void']], ['POST', "/loans/{$pret}/schedule/import", $corps['import']],
        ['GET', "/acquisitions/{$acq}", []], ['PATCH', "/acquisitions/{$acq}", $corps['acquisitions']]];

    foreach ($appels as [$methode, $chemin, $donnees]) {
        $reponse = $this->json($methode, $url($chemin), $donnees, ['Idempotency-Key' => 'intrusion-'.bin2hex(random_bytes(4))]);

        expect($reponse->status())->toBe(404, "{$methode} {$chemin} -> {$reponse->status()}");
    }

    $this->getJson($url('/loans'))->assertOk()->assertJsonCount(0, 'data');
    expect(DB::table('loans')->where('id', $pret)->value('status'))->toBe('active');
});

it('un bien d\'une autre organisation n\'est pas rattachable (404 property_not_found)', function (): void {
    $a = I::bailleur();
    $b = I::bailleur('M. Autre');
    I::comme($this, $b['owner']);

    I::pret($this, ['org' => $b['org'], 'property' => $a['property']])->assertNotFound();
});

it('réponses financières jamais mises en cache', function (): void {
    $b = I::bailleur();
    I::comme($this, $b['owner']);

    $this->getJson(I::url($b['org'], '/loans'))->assertHeader('Cache-Control', 'no-store, private');
});

it('le jeton opérateur d\'un membre de l\'organisation est refusé sur chaque route (operator_token_forbidden)', function (): void {
    $b = I::bailleur();
    $id = '0199f5d2-0000-7000-8000-000000000001';
    $jeton = X::jetonOperateur($b['owner']);
    X::changer();

    foreach ([['GET', '/acquisitions'], ['POST', '/acquisitions'], ['GET', "/acquisitions/{$id}"], ['PATCH', "/acquisitions/{$id}"], ['GET', '/loans'], ['POST', '/loans'], ['GET', "/loans/{$id}"], ['GET', "/loans/{$id}/schedule"],
        ['POST', "/loans/{$id}/schedule/import"], ['POST', "/loans/{$id}/prepayments"], ['POST', "/loans/{$id}/fees"], ['POST', "/loans/{$id}/attestations"], ['POST', "/loans/{$id}/void"]] as [$methode, $chemin]) {
        $this->withToken($jeton)->json($methode, I::url($b['org'], $chemin), [])->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }
});
