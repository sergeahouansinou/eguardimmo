<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Mail;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Information du mandant sans compte, en texte brut : type d'intervention, montant TTC et échéance de réponse, jamais de donnée
 * du locataire ni de lien de décision (ADR 0029). Le nom de l'organisation perd ses caractères de contrôle.
 */
final class ApprovalNoticeMail extends Mailable implements ShouldQueue
{
    use SerializesModels;

    public int $tries = 3;

    public bool $afterCommit = true;

    public readonly string $organisation;

    public function __construct(
        string $organisation,
        public readonly string $reference,
        public readonly string $nature,
        public readonly ?string $montant,
        public readonly ?string $echeance,
        public readonly bool $urgence,
    ) {
        $this->organisation = trim((string) preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $organisation));
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: ($this->urgence ? 'Intervention engagée en urgence ' : 'Accord demandé pour l\'intervention ')."{$this->reference} - {$this->organisation}");
    }

    public function content(): Content
    {
        return new Content(text: 'maintenance::mail.approval');
    }
}
