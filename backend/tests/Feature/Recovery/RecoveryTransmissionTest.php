<?php

declare(strict_types=1);

use App\Modules\Recovery\Mail\BundleLinkMail;
use App\Modules\Recovery\Models\RecoveryAct;
use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Recovery\RecoveryContext as X;

beforeEach(function (): void {
    X::preparer($this);
});

it('transmet l\'envoi : lien https par e-mail seulement, empreinte du jeton en base, acte au carnet, journal', function (): void {
    $s = X::dossier($this);
    $bundle = X::envoi($this, $s);
    $bailiff = X::bailiff($this, $s['org'], 'etude@martin-cj.fr', 'Étude Martin');

    $reponse = $this->postJson(X::url($s['org'], "/bundles/{$bundle}/transmissions"), ['recipient_party_id' => $bailiff])->assertCreated();

    $jeton = X::jeton();
    $reponse->assertJsonPath('data.state', 'active')
        ->assertJsonPath('data.recipient.email', 'etude@martin-cj.fr')
        ->assertJsonPath('data.recipient.party_id', $bailiff)
        ->assertJsonPath('data.download_count', 0);
    expect($reponse->json('data.expires_at'))->toStartWith('2026-11-23')
        ->and($reponse->getContent())->not->toContain($jeton)->not->toContain(hash('sha256', $jeton))->not->toContain('token')
        ->and($jeton)->toMatch('/^[A-Za-z0-9]{48}$/');

    Mail::assertSent(BundleLinkMail::class, 1);
    Mail::assertSent(BundleLinkMail::class, function (BundleLinkMail $mail) use ($jeton): bool {
        $texte = $mail->render();

        return $mail->hasTo('etude@martin-cj.fr')
            && $mail->lien === "https://liens.example.test/transmission/{$jeton}"
            && $mail->attachments === [] && $mail->rawAttachments === [] && $mail->diskAttachments === []
            && str_contains($texte, "\n\n{$mail->lien}\n\n")
            && str_contains($texte, 'Agence du Port')
            && str_contains($texte, 'RC-2026-0001')
            && str_contains($texte, '23/11/2026')
            && ! str_contains($texte, 'PK');
    });

    L::dans($s['org'], function () use ($jeton, $reponse, $bundle, $s): void {
        $transmission = RecoveryTransmission::query()->findOrFail($reponse->json('data.id'));
        $acte = RecoveryAct::query()->where('type', 'transmission')->firstOrFail();

        expect($transmission->token_hash)->toBe(hash('sha256', $jeton))
            ->and($transmission->sent_at)->not->toBeNull()
            ->and($acte->case_id)->toBe($s['case'])
            ->and($acte->reference)->toBe('EP-2026-0001')
            ->and($acte->performed_on->toDateString())->toBe('2026-11-16')
            ->and($acte->data['pieces_count'])->toBe(6)
            ->and($acte->data['recipient_name'])->toBe('Étude Martin')
            ->and($acte->data['bundle_id'])->toBe($bundle);
    });

    $secrets = DB::table('audit_logs')->get()->toJson().DB::table('recovery_acts')->get()->toJson().DB::table('recovery_transmissions')->get()->toJson().DB::table('jobs')->get()->toJson();
    expect($secrets)->not->toContain($jeton)
        ->and(AuditLog::query()->where('action', 'recovery.transmission.created')->count())->toBe(1);
});

it('règle la durée du lien : 7 jours par défaut, 30 au plus', function (): void {
    $s = X::dossier($this);
    $bundle = X::envoi($this, $s);
    $bailiff = X::bailiff($this, $s['org']);
    $url = X::url($s['org'], "/bundles/{$bundle}/transmissions");

    $this->postJson($url, ['recipient_party_id' => $bailiff, 'valid_days' => 30])->assertCreated()->assertJsonPath('data.expires_at', fn (string $d): bool => str_starts_with($d, '2026-12-16'));
    foreach ([31, 0, 'abc'] as $jours) {
        $this->postJson($url, ['recipient_party_id' => $bailiff, 'valid_days' => $jours])->assertUnprocessable();
    }
});

it('refuse un destinataire qui n\'est pas un commissaire de justice actif de l\'organisation, avec e-mail', function (): void {
    $s = X::dossier($this);
    $bundle = X::envoi($this, $s);
    $url = X::url($s['org'], "/bundles/{$bundle}/transmissions");
    $sansEmail = X::bailiff($this, $s['org'], null, 'Étude sans e-mail');
    $autre = X::impayes($this, nom: 'Autre Agence');
    $etranger = X::bailiff($this, $autre['org']);
    X::basculer($this, $s['org']);

    foreach ([L::partie($s['org'])->id, $sansEmail, $etranger, fake()->uuid()] as $destinataire) {
        $this->postJson($url, ['recipient_party_id' => $destinataire])->assertUnprocessable()->assertJsonPath('code', 'recovery_recipient_invalid');
    }

    $this->postJson($url, [])->assertUnprocessable();
    Mail::assertNothingSent();
    expect(L::dans($s['org'], fn () => RecoveryTransmission::query()->count()))->toBe(0)
        ->and(L::dans($s['org'], fn () => RecoveryAct::query()->count()))->toBe(0);
});

it('refuse de transmettre si l\'adresse https des liens n\'est pas configurée, sans rien écrire', function (): void {
    $s = X::dossier($this);
    $bundle = X::envoi($this, $s);
    $bailiff = X::bailiff($this, $s['org']);

    foreach (['http://liens.example.test/{token}', 'ftp://x/{token}'] as $modele) {
        config(['recovery.transmission.link_url' => $modele]);
        $this->postJson(X::url($s['org'], "/bundles/{$bundle}/transmissions"), ['recipient_party_id' => $bailiff])->assertStatus(503)->assertJsonPath('code', 'recovery_link_unavailable');
    }

    config(['recovery.transmission.link_url' => null, 'app.url' => 'https://api.eguardimmo.test']);
    $this->postJson(X::url($s['org'], "/bundles/{$bundle}/transmissions"), ['recipient_party_id' => $bailiff])->assertCreated();
    Mail::assertSent(BundleLinkMail::class, fn (BundleLinkMail $m): bool => str_starts_with($m->lien, 'https://api.eguardimmo.test/api/v1/recovery/downloads/'));
    expect(L::dans($s['org'], fn () => RecoveryTransmission::query()->count()))->toBe(1);
});

it('révoque un lien : acte au carnet, journal, lien mort, seconde révocation refusée', function (): void {
    $s = X::transmis($this);

    $this->postJson(X::url($s['org'], "/transmissions/{$s['transmission']}/revoke"), ['reason' => 'Envoyé à la mauvaise étude'])->assertOk()
        ->assertJsonPath('data.state', 'revoked')->assertJsonPath('data.revoked_at', fn (string $d): bool => str_starts_with($d, '2026-11-16'));

    L::dans($s['org'], function () use ($s): void {
        $acte = RecoveryAct::query()->where('type', 'revocation')->firstOrFail();

        expect($acte->case_id)->toBe($s['case'])->and($acte->note)->toBe('Envoyé à la mauvaise étude')->and($acte->reference)->toBe('EP-2026-0001')
            ->and($acte->data['transmission_id'])->toBe($s['transmission'])
            ->and(RecoveryTransmission::query()->findOrFail($s['transmission'])->revoked_by_user_id)->toBe(L::titulaire($s['org'])->id);
    });
    expect(AuditLog::query()->where('action', 'recovery.transmission.revoked')->count())->toBe(1);

    $this->postJson(X::url($s['org'], "/transmissions/{$s['transmission']}/revoke"))->assertConflict()->assertJsonPath('code', 'recovery_transmission_not_active');
    expect(L::dans($s['org'], fn () => RecoveryAct::query()->where('type', 'revocation')->count()))->toBe(1);
});

it('renvoie un lien : l\'ancien est révoqué, le nouveau le remplace, deux actes au carnet', function (): void {
    $s = X::transmis($this);
    $ancien = $s['token'];

    $reponse = $this->postJson(X::url($s['org'], "/transmissions/{$s['transmission']}/resend"), ['valid_days' => 10])->assertCreated();
    $nouveau = X::jeton();

    $reponse->assertJsonPath('data.replaces_id', $s['transmission'])->assertJsonPath('data.state', 'active')->assertJsonPath('data.recipient.email', 'etude@martin-cj.fr');
    expect($nouveau)->not->toBe($ancien);
    Mail::assertSent(BundleLinkMail::class, 2);

    $this->getJson(X::url($s['org'], "/bundles/{$s['bundle']}"))->assertOk()
        ->assertJsonCount(2, 'data.transmissions')->assertJsonPath('data.transmissions.1.state', 'revoked');
    $types = array_column($this->getJson(X::url($s['org'], "/cases/{$s['case']}/acts"))->json('data'), 'type');
    expect($types)->toBe(['transmission', 'revocation', 'transmission']);

    $this->postJson(X::url($s['org'], "/transmissions/{$reponse->json('data.id')}/resend"))->assertCreated();
    $this->postJson(X::url($s['org'], "/transmissions/{$s['transmission']}/resend"))->assertCreated();
    expect(L::dans($s['org'], fn () => RecoveryAct::query()->where('type', 'revocation')->count()))->toBe(2);
});

it('ne renvoie rien si le destinataire n\'est plus valable : l\'ancien lien reste actif', function (): void {
    $s = X::transmis($this);
    L::dans($s['org'], fn () => DB::table('contact_points')->where('party_id', $s['bailiff'])->delete());

    $this->postJson(X::url($s['org'], "/transmissions/{$s['transmission']}/resend"))->assertUnprocessable()->assertJsonPath('code', 'recovery_recipient_invalid');

    expect(L::dans($s['org'], fn () => RecoveryTransmission::query()->findOrFail($s['transmission'])->revoked_at))->toBeNull()
        ->and(L::dans($s['org'], fn () => RecoveryAct::query()->where('type', 'revocation')->count()))->toBe(0);
});

it('refuse de transmettre quand le dossier est clos', function (): void {
    $s = X::dossier($this);
    $bundle = X::envoi($this, $s);
    $bailiff = X::bailiff($this, $s['org']);
    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/status"), ['status' => 'closed'])->assertOk();

    $this->postJson(X::url($s['org'], "/bundles/{$bundle}/transmissions"), ['recipient_party_id' => $bailiff])->assertConflict()->assertJsonPath('code', 'recovery_case_not_active');
    Mail::assertNothingSent();
});
