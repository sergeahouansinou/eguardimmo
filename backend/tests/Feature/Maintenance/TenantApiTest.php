<?php

declare(strict_types=1);

use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionFile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
});

it('crée une demande : état simplifié, serveur seul maître de l\'organisation, du statut et de la priorité', function (): void {
    $reponse = C::signaler($this, $this->scene, ['status' => 'approved', 'priority' => 'urgent', 'organization_id' => fake()->uuid(), 'ceiling_amount' => 1, 'supplier_party_id' => fake()->uuid()])
        ->assertCreated()->assertJsonPath('data.state', 'reported')->assertJsonPath('data.cancellable', true);

    $intervention = Intervention::query()->withoutGlobalScopes()->findOrFail($reponse->json('data.id'));
    expect($intervention->organization_id)->toBe($this->scene['org']->id)
        ->and($intervention->status->value)->toBe('reported')
        ->and($intervention->priority->value)->not->toBe('urgent')
        ->and($intervention->ceiling_amount)->toBeNull()
        ->and($intervention->supplier_party_id)->toBeNull()
        ->and($intervention->origin->value)->toBe('tenant');
});

it('n\'expose au locataire ni montant, ni devis, ni facture, ni mandant, ni prestataire, ni donnée bancaire', function (): void {
    $id = C::travauxTermines($this, $this->scene);
    C::fichier($this, $this->scene, $id, 'quote');
    C::comme($this, $this->scene['tenant']);

    $json = $this->getJson(C::BASE."/tenant/interventions/{$id}")->assertOk()->assertJsonPath('data.state', 'done')->getContent();
    $liste = $this->getJson(C::BASE.'/tenant/interventions')->assertOk()->getContent();

    foreach ([$json, $liste] as $texte) {
        expect($texte)->not->toContain($this->scene['supplier']->id)->not->toContain($this->scene['mandant']->id)
            ->not->toContain('ceiling')->not->toContain('estimated')->not->toContain('approval')->not->toContain('invoice')->not->toContain('quote')
            ->not->toContain('iban')->not->toContain('bic')->not->toContain('supplier')->not->toContain('mandate')->not->toContain('responsibility')->not->toContain('total_gross');
    }
});

it('rejoue la création avec la même clé, exige la clé et refuse son réemploi pour une autre demande', function (): void {
    $premiere = C::signaler($this, $this->scene, [], 'cle-signal-1')->assertCreated();
    C::signaler($this, $this->scene, [], 'cle-signal-1')->assertOk()->assertJsonPath('data.id', $premiere->json('data.id'));
    C::signaler($this, $this->scene, ['title' => 'Autre sujet'], 'cle-signal-1')->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');
    $this->postJson(C::BASE.'/tenant/interventions', ['lease_id' => $this->scene['lease']->id, 'unit_id' => $this->scene['unit']->id, 'nature_term_id' => C::nature(), 'title' => 'Sans clé', 'description' => 'Sans clé'])
        ->assertUnprocessable()->assertJsonPath('code', 'idempotency_key_required');

    expect(Intervention::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('plafonne les demandes ouvertes par bail', function (): void {
    config(['maintenance.max_open_per_lease' => 2]);

    C::signaler($this, $this->scene)->assertCreated();
    C::signaler($this, $this->scene)->assertCreated();
    C::signaler($this, $this->scene)->assertUnprocessable()->assertJsonPath('code', 'intervention_too_many_open');
});

it('limite le débit des créations par locataire', function (): void {
    for ($i = 0; $i < 5; $i++) {
        C::signaler($this, $this->scene)->assertCreated();
    }

    C::signaler($this, $this->scene)->assertStatus(429);
});

it('refuse la demande sur un lot étranger au bail et sur un bail dont le locataire n\'est pas partie', function (): void {
    $autre = C::agence();

    C::signaler($this, $this->scene, ['unit_id' => $autre['unit']->id])->assertUnprocessable()->assertJsonPath('code', 'intervention_unit_invalid');
    C::signaler($this, $this->scene, ['lease_id' => $autre['lease']->id])->assertNotFound()->assertJsonPath('code', 'intervention_lease_not_found');
});

it('photos : EXIF retiré, type vérifié sur le contenu, plafond de pièces, taille maximale', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    $url = C::BASE."/tenant/interventions/{$id}/files";

    $fichier = $this->post($url, ['file' => C::photo()], ['Accept' => 'application/json'])->assertCreated()->json('data.files.0.id');
    $octets = $this->get(C::BASE."/tenant/interventions/{$id}/files/{$fichier}")->assertOk()->streamedContent();
    expect(substr($octets, 0, 3))->toBe("\xFF\xD8\xFF")->and($octets)->not->toContain('GPSLatitude')->not->toContain('SecretCam')->not->toContain('Exif');

    $this->post($url, ['file' => UploadedFile::fake()->createWithContent('photo.jpg', "%PDF-1.4\n%mauvais\n")], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('code', 'intervention_file_invalid');
    $this->post($url, ['file' => UploadedFile::fake()->create('grosse.jpg', 11000, 'image/jpeg')], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('code', 'validation_failed');

    for ($i = 0; $i < 5; $i++) {
        $this->post($url, ['file' => C::photo()], ['Accept' => 'application/json'])->assertCreated();
    }

    $this->post($url, ['file' => C::photo()], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('code', 'intervention_files_limit');
    expect(InterventionFile::query()->withoutGlobalScopes()->where('visible_to_tenant', true)->count())->toBe(6);
});

it('les fichiers sont stockés hors racine web, sous un nom régénéré', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    $this->post(C::BASE."/tenant/interventions/{$id}/files", ['file' => C::photo()], ['Accept' => 'application/json'])->assertCreated();

    $chemin = (string) DB::table('stored_files')->value('path');
    expect($chemin)->not->toContain('cuisine')->and(config('filesystems.disks.documents.visibility'))->toBe('private');
});

it('le locataire ne voit que la visibilité décidée par l\'équipe : commentaires internes et pièces comptables restent cachés', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    $devis = C::fichier($this, $this->scene, $id, 'quote');
    $photo = $this->post(C::url($this->scene['org'], "/interventions/{$id}/files"), ['file' => C::photo(), 'kind' => 'photo_before', 'visible_to_tenant' => true], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/comments"), ['text' => 'Note interne : prestataire pressenti trop cher.', 'visible_to_tenant' => false])->assertCreated();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/comments"), ['text' => 'Un plombier passera cette semaine.', 'visible_to_tenant' => true])->assertCreated();

    C::comme($this, $this->scene['tenant']);
    $corps = $this->getJson(C::BASE."/tenant/interventions/{$id}")->assertOk()->getContent();
    expect($corps)->toContain('Un plombier passera cette semaine.')->not->toContain('trop cher');

    $this->get(C::BASE."/tenant/interventions/{$id}/files/{$photo}")->assertOk();
    $this->get(C::BASE."/tenant/interventions/{$id}/files/{$devis}")->assertNotFound();
});

it('le contact du prestataire n\'apparaît qu\'une fois la visite confirmée', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::enDevisPour($this, $this->scene, $id);
    $devis = (string) C::devis($this, $this->scene, $id, 10000)->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertOk();
    $visite = $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/visits"), ['scheduled_on' => '2026-11-20', 'slot' => 'morning', 'presence_required' => true, 'contact_name' => 'Plomberie Dupont', 'contact_phone' => '0102030405'])->assertCreated()->json('data.id');

    C::comme($this, $this->scene['tenant']);
    $avant = $this->getJson(C::BASE."/tenant/interventions/{$id}")->assertOk()->getContent();
    expect($avant)->not->toContain('Plomberie Dupont')->not->toContain('0102030405');

    $this->postJson(C::BASE."/tenant/interventions/{$id}/visits/{$visite}/confirm")->assertOk();
    expect($this->getJson(C::BASE."/tenant/interventions/{$id}")->getContent())->toContain('Plomberie Dupont');
});

it('annule sa demande seulement tant qu\'elle n\'est pas prise en charge', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    $this->postJson(C::BASE."/tenant/interventions/{$id}/cancel")->assertOk()->assertJsonPath('data.state', 'cancelled');
    $this->postJson(C::BASE."/tenant/interventions/{$id}/comments", ['text' => 'Encore là ?'])->assertConflict();

    $autre = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::comme($this, $this->scene['owner']);
    $this->postJson(C::url($this->scene['org'], "/interventions/{$autre}/decline"), ['lock_version' => 1, 'reason' => 'out_of_scope', 'note' => 'Hors périmètre.'])->assertOk();
    C::comme($this, $this->scene['tenant']);
    $this->postJson(C::BASE."/tenant/interventions/{$autre}/cancel")->assertConflict();
});

it('le nombre de requêtes d\'une liste locataire ne dépend pas du nombre de demandes', function (): void {
    config(['maintenance.max_open_per_lease' => 50]);
    C::signaler($this, $this->scene)->assertCreated();
    DB::enableQueryLog();
    $this->getJson(C::BASE.'/tenant/interventions')->assertOk()->assertJsonCount(1, 'data');
    $un = count(DB::getQueryLog());

    for ($i = 0; $i < 4; $i++) {
        $this->travelTo(now()->addHours(2));
        C::signaler($this, $this->scene)->assertCreated();
    }

    DB::flushQueryLog();
    $this->getJson(C::BASE.'/tenant/interventions')->assertOk()->assertJsonCount(5, 'data');
    expect(count(DB::getQueryLog()))->toBe($un);
});

it('dans une même organisation, le locataire d\'un autre bail ne voit rien ; le colocataire du bail voit la demande', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    $voisin = C::voisin($this->scene['org']);
    $colocataire = C::colocataire($this->scene['org'], $this->scene['lease']);

    C::comme($this, $voisin['tenant']);
    $this->getJson(C::BASE."/tenant/interventions/{$id}")->assertNotFound();
    $this->postJson(C::BASE."/tenant/interventions/{$id}/comments", ['text' => 'Intrusion'])->assertNotFound();
    $this->getJson(C::BASE.'/tenant/interventions')->assertOk()->assertJsonCount(0, 'data');
    $this->postJson(C::BASE.'/tenant/interventions', ['lease_id' => $this->scene['lease']->id, 'unit_id' => $this->scene['unit']->id, 'nature_term_id' => C::nature(), 'title' => 'Intrusion', 'description' => 'Intrusion'], ['Idempotency-Key' => 'cle-intrusion'])
        ->assertNotFound()->assertJsonPath('code', 'intervention_lease_not_found');

    C::comme($this, $colocataire);
    $this->getJson(C::BASE."/tenant/interventions/{$id}")->assertOk();
    $this->getJson(C::BASE.'/tenant/interventions')->assertOk()->assertJsonCount(1, 'data');
});

it('un colocataire ne peut pas annuler la demande signalée par un autre', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    $colocataire = C::colocataire($this->scene['org'], $this->scene['lease']);

    C::comme($this, $colocataire);
    $this->postJson(C::BASE."/tenant/interventions/{$id}/cancel")->assertConflict()->assertJsonPath('code', 'intervention_transition_invalid');

    C::comme($this, $this->scene['tenant']);
    $this->getJson(C::BASE."/tenant/interventions/{$id}")->assertOk()->assertJsonPath('data.state', 'reported');
});

it('confirmation, report et fichier : l\'identifiant d\'une autre intervention donne 404', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::enDevisPour($this, $this->scene, $id);
    $devis = (string) C::devis($this, $this->scene, $id, 10000)->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertOk();
    $visite = $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/visits"), ['scheduled_on' => '2026-11-20', 'slot' => 'morning', 'presence_required' => true])->assertCreated()->json('data.id');
    $photo = $this->post(C::url($this->scene['org'], "/interventions/{$id}/files"), ['file' => C::photo(), 'kind' => 'photo_before', 'visible_to_tenant' => true], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

    C::comme($this, $this->scene['tenant']);
    $this->travelTo(now()->addHours(2));
    $autre = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');

    $this->postJson(C::BASE."/tenant/interventions/{$autre}/visits/{$visite}/confirm")->assertNotFound();
    $this->postJson(C::BASE."/tenant/interventions/{$autre}/visits/{$visite}/reschedule-request", ['requested_on' => '2026-11-25', 'slot' => 'afternoon'])->assertNotFound();
    $this->get(C::BASE."/tenant/interventions/{$autre}/files/{$photo}")->assertNotFound();
    $this->get(C::BASE."/tenant/interventions/{$id}/files/{$photo}")->assertOk();
});

it('le report d\'un créneau est refusé quand l\'intervention n\'est plus en cours de planification', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::enDevisPour($this, $this->scene, $id);
    $devis = (string) C::devis($this, $this->scene, $id, 10000)->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertOk();
    $visite = $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/visits"), ['scheduled_on' => '2026-11-20', 'slot' => 'morning', 'presence_required' => true])->assertCreated()->json('data.id');
    DB::table('interventions')->where('id', $id)->update(['status' => 'completed']);

    C::comme($this, $this->scene['tenant']);
    $this->postJson(C::BASE."/tenant/interventions/{$id}/visits/{$visite}/reschedule-request", ['requested_on' => '2026-11-25', 'slot' => 'afternoon'])->assertConflict()->assertJsonPath('code', 'visit_status_invalid');
    expect(DB::table('intervention_visits')->where('id', $visite)->value('status'))->not->toBe('reschedule_requested');
});
