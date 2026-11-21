<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Requests;

use App\Modules\Operations\Enums\ApprovableAction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreApprovalRequest extends FormRequest
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
            'action' => ['required', 'string', Rule::enum(ApprovableAction::class)],
            'subject_id' => ['required', 'uuid'],
            'reason' => ['required', 'string', 'min:10', 'max:500'],
            'ticket_reference' => ['nullable', 'string', 'max:40', 'regex:/^[A-Za-z0-9._\/-]+$/'],
            'payload' => ['nullable', 'array', 'max:10'],
            'payload.*' => ['nullable', 'string', 'max:64'],
        ];
    }

    public function approvalAction(): ApprovableAction
    {
        return ApprovableAction::from((string) $this->string('action'));
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(): array
    {
        $charge = $this->validated('payload');

        return is_array($charge) ? $charge : [];
    }
}
