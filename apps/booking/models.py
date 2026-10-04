from django.db import models


class ClientRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('QUOTED', 'Quote Generated'),
        ('BOOKED', 'Call Booked'),
        ('COMPLETED', 'Completed'),
    ]

    client_name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField()
    project_type = models.CharField(max_length=100)
    description = models.TextField()
    budget_range = models.CharField(max_length=100, blank=True, null=True)
    
    # AI and Automation fields
    ai_estimated_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    pdf_bill = models.FileField(upload_to='quotes/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Client Request"
        verbose_name_plural = "Client Requests"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.client_name} - {self.project_type} (${self.ai_estimated_price or 'Pending'})"