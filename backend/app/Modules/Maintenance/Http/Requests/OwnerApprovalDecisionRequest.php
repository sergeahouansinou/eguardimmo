<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Enums\ApprovalDecision;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class OwnerApprovalDecisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'decision' => ['required', 'string', Rule::enum(ApprovalDecision::class)],
            'comment' => ['nullable', 'string', 'max:500', 'required_if:decision,refuse,question', 'min:5'],
            'lock_version' => ['required', 'integer', 'min:1'],
            'quote_fingerprint' => ['required', 'string', 'regex:/^[0-9a-f]{64}$/'],
            'statement_version' => ['required', 'string', 'max:32'],
        ];
    }

    public function decision(): ApprovalDecision
    {
        return ApprovalDecision::from((string) $this->validated('decision'));
    }

    public function comment(): ?string
    {
        $commentaire = $this->validated('comment');

        return is_string($commentaire) && trim($commentaire) !== '' ? trim($commentaire) : null;
    }

    public function lockVersion(): int
    {
        return (int) $this->validated('lock_version');
    }

    public function quoteFingerprint(): string
    {
        return (string) $this->validated('quote_fingerprint');
    }

    public function statementVersion(): string
    {
        return (string) $this->validated('statement_version');
    }
}
