<?php

declare(strict_types=1);

use App\Modules\Invoicing\Mail\InvoiceMail;
use App\Modules\Invoicing\Models\Invoice;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    Mail::fake();
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
});

it('télécharge le PDF figé à l\'émission, en réponse privée', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);

    $reponse = $this->get(C::url($this->org, "/{$facture->id}/pdf"))->assertOk();

    expect($reponse->streamedContent())->toBe(DocumentsContext::PDF)
        ->and($reponse->headers->get('Cache-Control'))->toContain('no-store')
        ->and($reponse->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($reponse->headers->get('Content-Disposition'))->toContain('attachment');
    expect(AuditLog::query()->where('action', 'invoicing.invoice.downloaded')->count())->toBe(1);
});

it('un brouillon n\'a pas de PDF', function (): void {
    $id = $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated()->json('data.id');

    $this->getJson(C::url($this->org, "/{$id}/pdf"))->assertStatus(409)->assertJsonPath('code', 'invoice_not_issued');
});

it('envoie la facture par e-mail avec le PDF en pièce jointe, et journalise', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);

    $this->postJson(C::url($this->org, "/{$facture->id}/send"))->assertOk()->assertJsonPath('data.sent_at', fn ($v) => $v !== null);

    Mail::assertQueued(InvoiceMail::class, fn (InvoiceMail $m): bool => $m->hasTo('locataire@example.test') && $m->numero === $facture->number && count($m->attachments()) === 1 && $m->hasSubject('Facture '.$facture->number.' de Agence du Port SAS'));
    expect(L::dans($this->org, fn () => Invoice::query()->find($facture->id)->sent_at))->not->toBeNull();
    expect(AuditLog::query()->where('action', 'invoicing.invoice.sent')->count())->toBe(1);
});

it('refuse d\'envoyer sans adresse e-mail ou sans pièce émise', function (): void {
    $sansCourriel = C::destinataire($this->org, null);
    $facture = C::emettre($this, $this->org, $sansCourriel);
    $brouillon = $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated()->json('data.id');

    $this->postJson(C::url($this->org, "/{$facture->id}/send"))->assertUnprocessable()->assertJsonPath('code', 'invoice_recipient_email_missing');
    $this->postJson(C::url($this->org, "/{$brouillon}/send"))->assertStatus(409)->assertJsonPath('code', 'invoice_not_issued');
    Mail::assertNothingQueued();
});
