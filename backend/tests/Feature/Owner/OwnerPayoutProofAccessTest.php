<?php

declare(strict_types=1);

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerPayoutContext as P;
use Tests\Feature\Tenant\TenantWriteContext as W;

beforeEach(function (): void {
    ['org' => $this->org, 'mandant' => $this->mandant, 'awa' => $this->awa] = P::scene($this);
    $this->demande = P::demander($this, $this->awa, P::acces($this->awa))->assertCreated()->json('data.id');
    $this->fichier = (string) PayoutAccountRequest::query()->withoutGlobalScopes()->whereKey($this->demande)->value('proof_file_id');
    $this->generique = "/api/v1/org/{$this->org->id}/documents/files/{$this->fichier}/download";
    $this->dediee = "/api/v1/org/{$this->org->id}/owner-funds/payout-account-requests/{$this->demande}/proof";
});

it('range la pièce sous le sujet dédié, avec l\'identifiant de la demande', function (): void {
    $sujet = DB::table('stored_files')->where('id', $this->fichier)->first(['subject_type', 'subject_id']);

    expect($sujet->subject_type)->toBe(DocumentSubject::PAYOUT_ACCOUNT_REQUEST)->and($sujet->subject_id)->toBe($this->demande);
});

it('refuse la pièce par la route générique à un gestionnaire et à un comptable sans 2FA', function (): void {
    foreach ([MemberRole::Manager, MemberRole::Accountant] as $role) {
        O::comme($this, L::membre($this->org, $role));
        $this->getJson($this->generique)->assertNotFound()->assertJsonPath('code', 'file_not_found');
    }
});

it('refuse la pièce par la route générique même au titulaire, au comptable et à l\'admin avec 2FA', function (): void {
    foreach ([MemberRole::Owner, MemberRole::Admin, MemberRole::Accountant] as $role) {
        $compte = $role === MemberRole::Owner ? L::titulaire($this->org) : L::membre($this->org, $role);
        activerDeuxFacteurs($compte);
        O::comme($this, $compte);
        $this->getJson($this->generique)->assertNotFound();
    }
});

it('sert toujours la pièce par la route dédiée au titulaire, à l\'admin et au comptable avec 2FA, jamais au gestionnaire', function (): void {
    foreach ([MemberRole::Owner, MemberRole::Admin, MemberRole::Accountant] as $role) {
        $compte = $role === MemberRole::Owner ? L::titulaire($this->org) : L::membre($this->org, $role);
        activerDeuxFacteurs($compte);
        O::comme($this, $compte);
        $this->get($this->dediee)->assertOk();
    }

    O::comme($this, L::membre($this->org, MemberRole::Manager));
    $this->getJson($this->dediee)->assertForbidden();
});

it('laisse téléchargeable un document de bibliothèque de sujet party', function (): void {
    $document = W::fichier($this->org, 'bibliotheque.pdf', W::PDF, new DocumentSubject('party', $this->mandant->id));

    O::comme($this, L::membre($this->org, MemberRole::Manager));
    $this->get("/api/v1/org/{$this->org->id}/documents/files/{$document->id}/download")->assertOk();
});

it('migre les pièces existantes de sujet party vers le sujet dédié, sans toucher aux autres', function (): void {
    DB::table('stored_files')->where('id', $this->fichier)->update(['subject_type' => 'party', 'subject_id' => $this->mandant->id]);
    $autre = W::fichier($this->org, 'autre.pdf', W::PDF, new DocumentSubject('party', $this->mandant->id));

    (include base_path('app/Modules/OwnerFunds/Database/Migrations/2026_11_21_940000_move_payout_proofs_to_request_subject.php'))->up();

    $migre = DB::table('stored_files')->where('id', $this->fichier)->first(['subject_type', 'subject_id']);
    $intact = DB::table('stored_files')->where('id', $autre->id)->first(['subject_type', 'subject_id']);

    expect($migre->subject_type)->toBe(DocumentSubject::PAYOUT_ACCOUNT_REQUEST)->and($migre->subject_id)->toBe($this->demande)
        ->and($intact->subject_type)->toBe('party')->and($intact->subject_id)->toBe($this->mandant->id);
    $this->getJson($this->generique)->assertNotFound();
});
